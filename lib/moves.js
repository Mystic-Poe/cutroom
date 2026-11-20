'use strict';
// Undoable moves and Trash. Every operation is logged to ~/.cutroom/moves.log
// in batches, so `cutroom-undo-move` can reverse the last one.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { file, appendJsonl, readJsonl } = require('./home');

const LOG = () => file('moves.log');

function newBatch() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function exists(p) {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

function sizeOf(p) {
  const st = fs.statSync(p);
  if (!st.isDirectory()) return st.size;
  return fs.readdirSync(p).reduce((n, e) => n + sizeOf(path.join(p, e)), 0);
}

/** Move one file or folder; never overwrites; works across drives. */
function moveOne(src, dest) {
  if (exists(dest)) throw new Error(`${dest} already exists, so nothing was moved (cutroom never overwrites).`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    fs.renameSync(src, dest);
  } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    // different drive: copy, verify, then remove the original
    fs.cpSync(src, dest, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
    if (sizeOf(src) !== sizeOf(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
      throw new Error(`Copy of ${src} did not verify; the original is untouched.`);
    }
    fs.rmSync(src, { recursive: true, force: true });
  }
}

/** Plan where each source goes. Throws before touching anything if a step would fail. */
function planMoves(sources, dest) {
  const intoDir = sources.length > 1 || dest.endsWith('/') || (exists(dest) && fs.statSync(dest).isDirectory());
  const plan = sources.map((s) => {
    const from = path.resolve(s);
    const to = intoDir ? path.resolve(dest, path.basename(from)) : path.resolve(dest);
    return { from, to };
  });
  for (const { from, to } of plan) {
    if (!exists(from)) throw new Error(`${from} doesn't exist, so nothing was moved.`);
    if (exists(to)) throw new Error(`${to} already exists, so nothing was moved (cutroom never overwrites).`);
  }
  const targets = new Set();
  for (const { to } of plan) {
    if (targets.has(to)) throw new Error(`Two files would land on ${to}, so nothing was moved.`);
    targets.add(to);
  }
  return plan;
}

function move(sources, dest) {
  const plan = planMoves(sources, dest);
  const batch = newBatch();
  const done = [];
  for (const step of plan) {
    moveOne(step.from, step.to);
    const entry = { ts: new Date().toISOString(), batch, kind: 'move', ...step };
    appendJsonl(LOG(), entry);
    done.push(entry);
  }
  return done;
}

function trashDir() {
  if (process.env.CUTROOM_TRASH_DIR) return process.env.CUTROOM_TRASH_DIR;
  return path.join(os.homedir(), '.Trash');
}

function uniqueIn(dir, name) {
  let candidate = path.join(dir, name);
  if (!exists(candidate)) return candidate;
  const ext = path.extname(name);
  const stem = name.slice(0, name.length - ext.length);
  for (let i = 2; ; i++) {
    candidate = path.join(dir, `${stem} ${i}${ext}`);
    if (!exists(candidate)) return candidate;
  }
}

/** On macOS, ask Finder to trash it (keeps "Put Back" working). Returns the trashed path or null. */
function finderTrash(p) {
  if (process.platform !== 'darwin' || process.env.CUTROOM_TRASH_DIR) return null;
  const r = spawnSync('osascript', [
    '-e', 'on run argv',
    '-e', 'tell application "Finder" to set t to delete (POSIX file (item 1 of argv) as alias)',
    '-e', 'return POSIX path of (t as alias)',
    '-e', 'end run',
    p,
  ], { encoding: 'utf8' });
  const out = r.status === 0 ? r.stdout.trim().replace(/\/$/, '') : '';
  if (out) return out;
  // Finder may have trashed it but failed to report where: look for it.
  if (!exists(p)) {
    const dir = trashDir();
    const stem = path.basename(p, path.extname(p));
    const hit = (fs.readdirSync(dir, { withFileTypes: true }) || [])
      .filter((e) => e.name.startsWith(stem))
      .map((e) => path.join(dir, e.name))
      .sort((a, b) => fs.lstatSync(b).mtimeMs - fs.lstatSync(a).mtimeMs)[0];
    return hit || path.join(dir, path.basename(p));
  }
  return null;
}

function trash(paths) {
  const batch = newBatch();
  const done = [];
  const items = paths.map((p) => path.resolve(p));
  for (const from of items) if (!exists(from)) throw new Error(`${from} doesn't exist, so nothing was moved to the Trash.`);
  for (const from of items) {
    let to = finderTrash(from);
    if (!to) {
      const dir = trashDir();
      fs.mkdirSync(dir, { recursive: true });
      to = uniqueIn(dir, path.basename(from));
      moveOne(from, to);
    }
    const entry = { ts: new Date().toISOString(), batch, kind: 'trash', from, to };
    appendJsonl(LOG(), entry);
    done.push(entry);
  }
  return done;
}

/** Batches not yet undone, newest last. */
function openBatches() {
  const entries = readJsonl(LOG());
  const undone = new Set(entries.filter((e) => e.kind === 'undo').map((e) => e.batch));
  const order = [];
  const byBatch = new Map();
  for (const e of entries) {
    if (e.kind !== 'move' && e.kind !== 'trash') continue;
    if (undone.has(e.batch)) continue;
    if (!byBatch.has(e.batch)) {
      byBatch.set(e.batch, []);
      order.push(e.batch);
    }
    byBatch.get(e.batch).push(e);
  }
  return order.map((b) => byBatch.get(b));
}

function undo(n = 1) {
  const batches = openBatches().slice(-n).reverse();
  if (!batches.length) throw new Error('There is nothing to undo.');
  const restored = [];
  for (const batch of batches) {
    for (const e of batch) {
      if (!exists(e.to)) throw new Error(`${e.to} is no longer there, so this move can't be undone automatically.`);
      if (exists(e.from)) throw new Error(`Something is already at ${e.from}, so the move wasn't undone (nothing was overwritten).`);
    }
    for (const e of batch.slice().reverse()) {
      moveOne(e.to, e.from);
      restored.push(e);
    }
    appendJsonl(LOG(), { ts: new Date().toISOString(), batch: batch[0].batch, kind: 'undo' });
  }
  return restored;
}

function describe(entries, verb) {
  if (!entries.length) return `${verb} nothing.`;
  const home = os.homedir();
  const tidy = (p) => p.replace(home, '~');
  if (entries.length === 1) return `${verb} ${tidy(entries[0].from)} → ${tidy(entries[0].to)}.`;
  const dests = new Set(entries.map((e) => path.dirname(e.to)));
  const where = dests.size === 1 ? ` into ${tidy([...dests][0])}` : '';
  return `${verb} ${entries.length} items${where}.`;
}

module.exports = { move, trash, undo, openBatches, describe, planMoves };
