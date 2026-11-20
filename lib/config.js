'use strict';
// The editor's folder setup: where AI-edits lives, which drives hold media,
// and which folder names are locked (raw/ by default).
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

function isInside(p, roots) {
  const target = path.resolve(expand(p));
  return (roots || []).some((r) => {
    const root = path.resolve(expand(r));
    return target === root || target.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
  });
}

function isLocked(p, cfg) {
  const target = path.resolve(expand(p));
  const locked = new Set(cfg.lockedFolders || DEFAULTS.lockedFolders);
  const roots = cfg.projectRoots || [];
  const segs = target.split(path.sep);
  if (roots.length === 0) return segs.some((s) => locked.has(s));
  return roots.some((r) => {
    const root = path.resolve(expand(r));
    if (!isInside(target, [root])) return false;
    const rel = path.relative(root, target).split(path.sep);
    return rel.some((s) => locked.has(s));
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

module.exports = { DEFAULTS, expand, resolve, isInside, isLocked, loadConfig };
