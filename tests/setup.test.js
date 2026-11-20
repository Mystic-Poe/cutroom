const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { tmpdir, run, ROOT } = require('./helpers');

function env() {
  const home = tmpdir();
  const claude = tmpdir();
  const settings = path.join(claude, 'settings.json');
  return { home, claude, settings, env: { CUTROOM_HOME: home, CUTROOM_CLAUDE_DIR: claude } };
}

test('--diff on empty settings lists the three changes and writes nothing', () => {
  const e = env();
  const r = run('cutroom-apply-settings', ['--diff'], { env: e.env });
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /statusLine/);
  assert.match(r.out, /custom:cutroom/);
  assert.match(r.out, /spinnerTipsEnabled/);
  assert.equal(fs.existsSync(e.settings), false);
});

test('--write merges, keeps other keys, backs up, installs launcher and theme', () => {
  const e = env();
  fs.writeFileSync(e.settings, JSON.stringify({ model: 'opus', permissions: { allow: ['Bash(ls)'] }, statusLine: { type: 'command', command: 'old.sh' } }, null, 2));
  const r = run('cutroom-apply-settings', ['--write'], { env: e.env });
  assert.equal(r.code, 0, r.err);
  const s = JSON.parse(fs.readFileSync(e.settings, 'utf8'));
  assert.equal(s.model, 'opus');
  assert.deepEqual(s.permissions, { allow: ['Bash(ls)'] });
  assert.equal(s.theme, 'custom:cutroom');
  assert.equal(s.spinnerTipsEnabled, false);
  assert.equal(s.statusLine.refreshInterval, 5);
  assert.match(s.statusLine.command, /statusline\.sh$/);
  const backups = fs.readdirSync(e.claude).filter((f) => f.startsWith('settings.json.cutroom-backup-'));
  assert.equal(backups.length, 1);
  assert.match(fs.readFileSync(path.join(e.claude, backups[0]), 'utf8'), /old\.sh/);
  assert.ok(fs.existsSync(path.join(e.claude, 'themes', 'cutroom.json')));
  // launcher runs and prints a status line
  const launcher = s.statusLine.command;
  const out = spawnSync('/bin/sh', [launcher], { input: '{"workspace":{"current_dir":"/x/v1"}}', encoding: 'utf8', env: { ...process.env, ...e.env, NO_COLOR: '1' } });
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /v1/);
});

test('--write twice is a no-op the second time (no extra backup)', () => {
  const e = env();
  run('cutroom-apply-settings', ['--write'], { env: e.env });
  const r = run('cutroom-apply-settings', ['--write'], { env: e.env });
  assert.equal(r.code, 0);
  assert.match(r.out, /already/i);
  assert.equal(fs.readdirSync(e.claude).filter((f) => f.includes('cutroom-backup')).length, 0);
});

test('--config writes ~/.cutroom/config.json', () => {
  const e = env();
  const r = run('cutroom-apply-settings', ['--config', JSON.stringify({ projectRoots: ['~/AI-edits'], mediaRoots: ['/Volumes/Media'] })], { env: e.env });
  assert.equal(r.code, 0, r.err);
  const c = JSON.parse(fs.readFileSync(path.join(e.home, 'config.json'), 'utf8'));
  assert.deepEqual(c.mediaRoots, ['/Volumes/Media']);
  assert.deepEqual(c.lockedFolders, ['raw']);
});

test('doctor prints a checklist and never fails', () => {
  const e = env();
  const r = run('cutroom-doctor', [], { env: { ...e.env, CUTROOM_DOCTOR_FAST: '1' } });
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /Node/);
  assert.match(r.out, /ffmpeg/);
  assert.match(r.out, /Resolve/);
  assert.ok(r.out.split('\n').filter((l) => /^[✓✗–!]/.test(l.trim())).length >= 6);
});
