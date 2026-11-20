'use strict';
// cutroom's safety guard. Given a PreToolUse hook input, decide:
//   { decision: 'deny', reason }  block it, and tell Claude the safe route
//   { decision: 'ask',  reason }  ask the editor, in plain English
//   null                          no opinion; Claude Code's own rules apply
// It never returns 'allow', so it can never weaken Claude Code's checks.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { segments, SHELLS } = require('./shell');
const { expand, isInside, isLocked, canonical } = require('./config');
const { operands } = require('./args');

const MEDIA_EXT = new Set(
  'mov mp4 m4v mxf avi mkv webm braw r3d ari crm dng wav aif aiff mp3 m4a aac flac png jpg jpeg tif tiff exr dpx psd heic drp drt dra fcpxml fcpxmld otio edl aaf'.split(' ')
);
const READERS = new Set('cat less more head tail grep egrep fgrep rg jq ls stat file wc diff cmp md5 shasum sha256sum test [ realpath readlink basename dirname'.split(' '));
const DOWNLOADERS = new Set(['curl', 'wget']);
const INTERPRETERS = new Set([...SHELLS, 'python', 'python3', 'node', 'perl', 'ruby', 'osascript']);

const REASONS = {
  delete: "Deletes go through `cutroom-trash`, which moves files to the macOS Trash so they can be put back. Use `cutroom-trash <paths>` instead.",
  mv: 'Moves and renames go through `cutroom-mv <sources...> <destination>`: it never overwrites and logs the move so it can be undone. Use that instead of `mv`.',
  cp: 'Copy with `cp -n` so existing files are never overwritten.',
  ffmpegY: 'Never overwrite media: drop `-y`, add `-n`, and write to a new file name.',
  ffmpegN: 'Add `-n` to ffmpeg (never overwrite) and write to a new file name.',
  sudo: 'Admin (sudo) commands are not allowed in cutroom. If something truly needs it, explain to the editor what and why, and let them run it themselves.',
  disk: 'Erasing, partitioning or formatting disks is not allowed in cutroom.',
  chmodR: 'Recursive permission changes on editing folders or drives are not allowed in cutroom.',
  pipeShell: "Don't run downloaded scripts. Download the file, show the editor what it is, and let them run it themselves if they want to.",
  settings: 'Claude Code and shell settings only change through /cutroom-setup.',
  overwrite: 'Footage and project files are never overwritten. Write to a new file name instead.',
  rawExisting: 'Files already in a raw/ folder are read-only. Write a new file somewhere else (clips/, renders/).',
};

const PROTECTED_BASENAMES = new Set(['.zshrc', '.bashrc', '.zprofile', '.bash_profile', '.profile', '.zshenv']);

function isProtectedPath(p) {
  if (!p) return false;
  // canonical(): symlinks resolved, case-folded on macOS
  const abs = canonical(p);
  const home = canonical(os.homedir());
  const fold = (s) => (abs === abs.toLowerCase() ? s.toLowerCase() : s);
  const b = path.basename(abs);
  if ([...PROTECTED_BASENAMES].some((n) => fold(n) === b) && path.dirname(abs) === home) return true;
  if (new RegExp(`^${fold('settings')}(\\.${fold('local')})?\\.json$`).test(b) && path.basename(path.dirname(abs)) === fold('.claude')) return true;
  return false;
}

function isMedia(p) {
  const ext = path.extname(p || '').slice(1).toLowerCase();
  return MEDIA_EXT.has(ext);
}

function exists(p) {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

const TMP_ROOTS = [os.tmpdir(), '/tmp', '/private/tmp', '/var/folders', '/private/var/folders'];

function outsideFolders(p, cfg) {
  const roots = [...(cfg.projectRoots || []), ...(cfg.mediaRoots || [])];
  if (roots.length === 0) return false; // not configured yet: skip this check
  if (p === '/dev/null' || p.startsWith('/dev/')) return false;
  if (isInside(p, TMP_ROOTS)) return false;
  return !isInside(p, roots);
}

function short(p, cwd) {
  const rel = path.relative(cwd, p);
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) return rel || '.';
  return p.replace(os.homedir(), '~');
}

// ---- verdict accumulator ----
function verdicts() {
  const denies = [];
  const asks = [];
  return {
    deny: (r) => denies.includes(r) || denies.push(r),
    ask: (r) => asks.includes(r) || asks.push(r),
    result() {
      if (denies.length) return { decision: 'deny', reason: denies.join(' ') };
      if (asks.length) return { decision: 'ask', reason: asks.join(' ') };
      return null;
    },
  };
}

const flags = (args) => args.filter((a) => a.startsWith('-'));
const nonFlags = (args) => args.filter((a) => !a.startsWith('-'));
const hasShortFlag = (args, ch) => args.some((a) => /^-[A-Za-z]+$/.test(a) && a.includes(ch));

function remoteSpec(a) {
  // host:path or user@host:path, but not /abs/path, ./x, or C:\ style
  return /^[A-Za-z0-9._@-]+:/.test(a) && !a.startsWith('/') && !/^[A-Za-z]:\\/.test(a);
}

// ---- Bash ----
function checkBash(command, cwd0, cfg) {
  const v = verdicts();
  const segs = segments(command);
  let cwd = cwd0;
  const at = (p) => canonicalFrom(p, cwd);

  // pipelines that feed a download into an interpreter
  const byPipe = new Map();
  for (const s of segs) {
    if (s.inner) continue;
    if (!byPipe.has(s.pipeIndex)) byPipe.set(s.pipeIndex, []);
    byPipe.get(s.pipeIndex).push(s);
  }
  for (const pipe of byPipe.values()) {
    const dl = pipe.findIndex((s) => DOWNLOADERS.has(s.cmd));
    if (dl !== -1 && pipe.some((s, i) => i > dl && INTERPRETERS.has(s.cmd))) v.deny(REASONS.pipeShell);
  }

  for (const s of segs) {
    const { cmd, args } = s;

    // a command name we can't read (built from variables or substitutions): ask
    if (/[$`*?{}\[\]]/.test(s.path)) {
      v.ask(`cutroom can't tell what \`${s.path}\` runs, so it is asking. OK to run this?`);
      continue;
    }

    // a shell or interpreter fed by a substitution that downloads
    if (INTERPRETERS.has(cmd) && s.subs.some((b) => /\b(curl|wget)\b/.test(b))) v.deny(REASONS.pipeShell);

    // redirections onto protected or existing media files
    for (const r of s.redirects) {
      if (!r.op.includes('>')) continue;
      const t = at(r.target);
      if (isProtectedPath(t)) v.deny(REASONS.settings);
      else if (exists(t) && (isMedia(t) || isLocked(t, cfg))) v.deny(REASONS.overwrite);
      else if (outsideFolders(t, cfg)) v.ask(`This writes ${short(t, cwd)}, which is outside your editing folders. OK?`);
    }

    // protected settings touched by anything but a reader (or our own setup tool)
    if (!READERS.has(cmd) && cmd !== 'cutroom-apply-settings' && args.some((a) => isProtectedPath(at(a)))) v.deny(REASONS.settings);

    switch (cmd) {
      case 'cd':
        if (args[0] && !args[0].startsWith('-')) cwd = at(args[0]);
        break;
      case 'rm':
      case 'rmdir':
      case 'unlink':
      case 'shred':
      case 'srm':
      case 'trash':
        v.deny(REASONS.delete);
        break;
      case 'find':
        if (args.includes('-delete')) v.deny(REASONS.delete);
        for (const f of ['-exec', '-execdir', '-ok', '-okdir']) {
          const i = args.indexOf(f);
          if (i !== -1 && /^(\/.*\/)?(rm|unlink|shred|rmdir|mv)$/.test(args[i + 1] || '')) v.deny(REASONS.delete);
        }
        break;
      case 'mv':
        v.deny(REASONS.mv);
        break;
      case 'cp':
      case 'ditto':
        if (cmd === 'ditto' || !(hasShortFlag(args, 'n') || args.includes('--no-clobber') || args.includes('--update=none'))) v.deny(REASONS.cp);
        else {
          const dest = nonFlags(args).at(-1);
          if (dest && outsideFolders(at(dest), cfg)) v.ask(`This copies files to ${short(at(dest), cwd)}, outside your editing folders. OK?`);
        }
        break;
      case 'ffmpeg':
        if (args.includes('-y')) v.deny(REASONS.ffmpegY);
        else if (args.includes('-i') && !args.includes('-n')) v.deny(REASONS.ffmpegN);
        else if (args.includes('-i')) {
          const out = nonFlags(args).at(-1);
          if (out && out !== '-' && outsideFolders(at(out), cfg)) v.ask(`ffmpeg will write ${short(at(out), cwd)}, outside your editing folders. OK?`);
        }
        break;
      case 'sudo':
      case 'doas':
        v.deny(REASONS.sudo);
        break;
      case 'diskutil':
        if (/^(erase|partition|reformat|zerodisk|randomdisk|secureerase|apfs)/i.test(args[0] || '') &&
            !(args[0] === 'apfs' && /^list/i.test(args[1] || ''))) v.deny(REASONS.disk);
        break;
      case 'dd':
        if (args.some((a) => a.startsWith('of='))) v.deny(REASONS.disk);
        break;
      case 'chmod':
      case 'chown':
      case 'chgrp':
        if (hasShortFlag(args, 'R')) {
          const targets = nonFlags(args).slice(1).map(at);
          const roots = [...(cfg.projectRoots || []), ...(cfg.mediaRoots || []), '/Volumes', os.homedir()];
          if (targets.some((t) => isInside(t, roots) || t === canonical(os.homedir()))) v.deny(REASONS.chmodR);
        }
        break;
      case 'cutroom-trash': {
        let ops;
        try {
          ops = operands(args);
        } catch {
          v.deny('cutroom-trash takes only file paths. Write a file that starts with "-" as ./-name.');
          break;
        }
        const files = ops.map((a) => path.basename(a));
        const list = files.slice(0, 3).join(', ') + (files.length > 3 ? `, and ${files.length - 3} more` : '');
        v.ask(`Move ${files.length} item${files.length === 1 ? '' : 's'} to the Trash (${list})? You can get ${files.length === 1 ? 'it' : 'them'} back from the Trash.`);
        break;
      }
      case 'cutroom-mv': {
        let parts;
        try {
          parts = operands(args);
        } catch {
          v.deny('cutroom-mv takes only file paths. Write a file that starts with "-" as ./-name.');
          break;
        }
        const dest = parts.at(-1);
        const srcs = parts.slice(0, -1);
        const locked = srcs.filter((p) => isLocked(at(p), cfg));
        if (locked.length) {
          const names = locked.slice(0, 3).map((p) => path.basename(p)).join(', ');
          v.ask(`${names}${locked.length > 3 ? ` and ${locked.length - 3} more` : ''} ${locked.length === 1 ? 'is' : 'are'} in a raw/ folder. Moving ${locked.length === 1 ? 'it' : 'them'} can make Resolve show the clip as Media Offline. Move anyway?`);
        }
        if (dest && outsideFolders(at(dest), cfg)) v.ask(`This moves files to ${short(at(dest), cwd)}, outside your editing folders. OK?`);
        break;
      }
      case 'cutroom-apply-settings':
        if (args.includes('--write')) v.ask('Apply the cutroom settings shown above to Claude Code (a backup of your current settings is kept)?');
        break;
      case 'curl': {
        const up = args.some((a, i) =>
          ['-T', '--upload-file', '-F', '--form', '--form-string'].includes(a) ||
          (['-d', '--data', '--data-binary', '--data-raw', '--data-urlencode'].includes(a) && (args[i + 1] || '').includes('@')) ||
          /^-[A-Za-z]*T$/.test(a)
        );
        if (up) v.ask('This uploads a file from your Mac to the internet. OK?');
        break;
      }
      case 'wget':
        if (args.some((a) => a.startsWith('--post-file') || a.startsWith('--body-file'))) v.ask('This uploads a file from your Mac to the internet. OK?');
        break;
      case 'scp':
      case 'sftp':
        v.ask('This copies files to another computer. OK?');
        break;
      case 'rsync':
        if (nonFlags(args).some(remoteSpec)) v.ask('This copies files to another computer. OK?');
        break;
      case 'rclone':
        if (/^(copy|sync|move|copyto|moveto|bisync)$/.test(args[0] || '')) v.ask('This sends files to cloud storage. OK?');
        break;
      case 'aws':
      case 'gsutil':
      case 'gcloud':
        if (/\b(cp|sync|mv|upload)\b/.test(args.join(' '))) v.ask('This sends files to cloud storage. OK?');
        break;
      case 'brew':
        if (/^(install|reinstall|upgrade|tap)$/.test(args[0] || '')) v.ask(`Install software with Homebrew (\`brew ${args.join(' ')}\`)?`);
        break;
      case 'npm':
      case 'pnpm':
      case 'yarn':
      case 'bun':
        if (/^(i|install|add)$/.test(args[0] || '') && (flags(args).some((f) => f === '-g' || f === '--global') || cmd === 'yarn' && args[0] === 'global'))
          v.ask(`Install a tool for your whole Mac (\`${cmd} ${args.join(' ')}\`)?`);
        if (cmd === 'pnpm' && args[0] === 'dlx') v.ask(`Download and run \`${args[1] || 'a package'}\`?`);
        break;
      case 'npx':
      case 'bunx':
        if (!args.includes('--no-install')) v.ask(`Download and run \`${nonFlags(args)[0] || 'a package'}\` (\`${cmd} ${args.join(' ')}\`)?`);
        break;
      case 'pip':
      case 'pip3':
      case 'pipx':
      case 'gem':
        if (args[0] === 'install') v.ask(`Install \`${nonFlags(args).slice(1).join(' ')}\` (${cmd})?`);
        break;
      case 'uv':
        if ((args[0] === 'tool' && args[1] === 'install') || (args[0] === 'pip' && args[1] === 'install')) v.ask(`Install \`${args.slice(2).join(' ')}\` (uv)?`);
        break;
      case 'claude':
        if (args[0] === 'plugin' && /^(install|marketplace|i)$/.test(args[1] || '')) v.ask(`Add a Claude Code plugin (\`claude ${args.join(' ')}\`)?`);
        if (args[0] === 'mcp' && args[1] === 'add') v.ask(`Connect a new tool to Claude (\`claude ${args.join(' ')}\`)?`);
        break;
      case 'killall':
      case 'pkill':
        if (args.some((a) => /resolve/i.test(a))) v.ask('Quit DaVinci Resolve? Unsaved changes could be lost.');
        break;
      case 'osascript':
        if (/resolve/i.test(args.join(' ')) && /\bquit\b/i.test(args.join(' '))) v.ask('Quit DaVinci Resolve? Unsaved changes could be lost.');
        break;
      case 'higgsfield': {
        const sub = (nonFlags(args)[0] || '').toLowerCase();
        const free = new Set(['', 'balance', 'credits', 'auth', 'login', 'logout', 'whoami', 'models', 'list', 'ls', 'status', 'help', 'version', 'get', 'show', 'estimate', 'quote']);
        if (!free.has(sub)) v.ask(`This runs \`higgsfield ${args.join(' ')}\`, which may spend Higgsfield credits. Check the cost first. Go ahead?`);
        break;
      }
      default:
        break;
    }
  }
  return v.result();
}

function canonicalFrom(p, cwd) {
  const e = expand(p);
  return path.isAbsolute(e) ? e : path.resolve(cwd, e);
}

// ---- file tools ----
function checkFile(filePath, cwd, cfg) {
  if (!filePath) return null;
  const p = canonicalFrom(filePath, cwd);
  if (isProtectedPath(p)) return { decision: 'deny', reason: REASONS.settings };
  const there = exists(p);
  const locked = isLocked(p, cfg);
  if (there && isMedia(p)) return { decision: 'deny', reason: REASONS.overwrite };
  if (there && locked) return { decision: 'deny', reason: REASONS.rawExisting };
  if (locked) return { decision: 'ask', reason: `Add a new file, ${path.basename(p)}, to the raw/ folder? raw/ is meant for original footage.` };
  if (outsideFolders(p, cfg)) return { decision: 'ask', reason: `This writes ${short(p, cwd)}, which is outside your editing folders. OK?` };
  return null;
}

// ---- MCP tools ----
const HIGGS_SPEND = /(generate|_batch$|execute_preset|upscale|remove_background|outpaint|reframe|voice_change|create_voice|separate_stems|motion_control|animation_actions|gpu_rent|gpu_job_start|gpu_rental_exec|build_ai_influencer|scene_builder_3d_(generate|create|run)|video_analysis_create|virality_predictor|participate_in_contest)/;
const HIGGS_SEND = /(publish|deploy|share_|tiktok_(prepare_publish|connect)|meta_ads_write|media_upload|media_import_url|update_project_sharing)/;
const HIGGS_DELETE = /(delete_|remove_project_asset|archive_project|trash)/;

function checkMcp(toolName) {
  const name = toolName.toLowerCase();
  const m = /^mcp__(.+?)__(.+)$/.exec(name);
  if (!m) return null;
  const [, server, tool] = m;
  if (server.includes('higgsfield')) {
    if (HIGGS_SPEND.test(tool)) return { decision: 'ask', reason: `Higgsfield "${tool}" spends credits. Claude should have quoted the model, length and cost above. Go ahead?` };
    if (HIGGS_SEND.test(tool)) return { decision: 'ask', reason: `Higgsfield "${tool}" publishes or uploads something. OK?` };
    if (HIGGS_DELETE.test(tool)) return { decision: 'ask', reason: `Higgsfield "${tool}" deletes or archives something in your Higgsfield account. OK?` };
    return null;
  }
  if (server.includes('resolve') || server.includes('davinci')) {
    if (/run_script|execute|eval/.test(tool)) return { decision: 'ask', reason: 'Claude wants to run a custom script inside DaVinci Resolve. OK?' };
    return null;
  }
  return null;
}

function decide(input, cfg) {
  const tool = input && input.tool_name;
  const ti = (input && input.tool_input) || {};
  const cwd = (input && input.cwd) || process.cwd();
  if (!tool) return null;
  if (tool === 'Bash') return checkBash(String(ti.command || ''), cwd, cfg);
  if (tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit') return checkFile(ti.file_path, cwd, cfg);
  if (tool === 'NotebookEdit') return checkFile(ti.notebook_path, cwd, cfg);
  if (tool.startsWith('mcp__')) return checkMcp(tool);
  return null;
}

module.exports = { decide, isProtectedPath, isMedia, REASONS };
