'use strict';
// The editor's folder setup: where AI-edits lives, which drives hold media,
// and which folder names are locked (raw/ by default).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { file, readJson } = require('./home');

const DEFAULTS = { projectRoots: [], mediaRoots: [], lockedFolders: ['raw'] };

function expand(p) {
  if (typeof p !== 'string' || !p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function resolve(p, cwd = process.cwd()) {
  return path.resolve(cwd, expand(p));
}

// macOS and Windows file systems are case-insensitive by default, so compare
// case-folded there (raw/ and Raw/ are the same folder). CUTROOM_CASEFOLD=1|0
// overrides, which the tests use.
function caseInsensitive() {
  if (process.env.CUTROOM_CASEFOLD === '1') return true;
  if (process.env.CUTROOM_CASEFOLD === '0') return false;
  return process.platform === 'darwin' || process.platform === 'win32';
}

// Absolute, symlink-resolved form of a path. For a path that does not exist
// yet, resolve its nearest existing parent and keep the rest as written.
function canonical(p) {
  let target = path.resolve(expand(p));
  const rest = [];
  for (;;) {
    try {
      target = path.join(fs.realpathSync.native(target), ...rest.reverse());
      break;
    } catch {
      const parent = path.dirname(target);
      if (parent === target) {
        target = path.join(target, ...rest.reverse());
        break;
      }
      rest.push(path.basename(target));
      target = parent;
    }
  }
  return caseInsensitive() ? target.toLowerCase() : target;
}

function within(target, root) {
  return target === root || target.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
}

function isInside(p, roots) {
  const target = canonical(p);
  return (roots || []).some((r) => within(target, canonical(r)));
}

function isLocked(p, cfg) {
  const target = canonical(p);
  const fold = caseInsensitive();
  const locked = new Set((cfg.lockedFolders || DEFAULTS.lockedFolders).map((s) => (fold ? s.toLowerCase() : s)));
  const roots = cfg.projectRoots || [];
  if (roots.length === 0) return target.split(path.sep).some((s) => locked.has(s));
  return roots.some((r) => {
    const root = canonical(r);
    if (!within(target, root)) return false;
    return path.relative(root, target).split(path.sep).some((s) => locked.has(s));
  });
}

function loadConfig() {
  const raw = readJson(file('config.json'), {}) || {};
  const list = (v, d) => (Array.isArray(v) ? v.map(expand) : d);
  return {
    projectRoots: list(raw.projectRoots, []),
    mediaRoots: list(raw.mediaRoots, []),
    lockedFolders: Array.isArray(raw.lockedFolders) && raw.lockedFolders.length ? raw.lockedFolders : ['raw'],
  };
}

module.exports = { DEFAULTS, expand, resolve, canonical, caseInsensitive, isInside, isLocked, loadConfig };
