'use strict';
// Long-running jobs report progress here; the band and status line read it.
const { file, readJson, writeJsonAtomic } = require('./home');

const DAY = 24 * 3600e3;
const now = () => (process.env.CUTROOM_NOW ? Number(process.env.CUTROOM_NOW) : Date.now());
const PATH = () => file('jobs.json');

function load() {
  const data = readJson(PATH(), { jobs: [] });
  return Array.isArray(data && data.jobs) ? data.jobs : [];
}

function save(jobs) {
  const t = now();
  writeJsonAtomic(PATH(), { jobs: jobs.filter((j) => t - (j.updatedAt || 0) < DAY) });
}

function find(jobs, id, cwd) {
  return jobs.find((j) => j.id === id && j.cwd === cwd);
}

function start(id, label, { total = null, cwd = process.cwd() } = {}) {
  const jobs = load().filter((j) => !(j.id === id && j.cwd === cwd));
  const t = now();
  jobs.push({ id, label, cwd, total, done: 0, current: null, status: 'running', startedAt: t, updatedAt: t, etaSec: null, reason: null });
  save(jobs);
}

function progress(id, done, { current = null, cwd = process.cwd() } = {}) {
  const jobs = load();
  const j = find(jobs, id, cwd);
  if (!j) throw new Error(`No job called "${id}" in this folder. Run \`cutroom-job start ${id} "<label>"\` first.`);
  const t = now();
  j.done = done;
  if (current) j.current = current;
  j.updatedAt = t;
  const elapsed = (t - j.startedAt) / 1000;
  if (j.total && done > 0 && elapsed > 0) j.etaSec = Math.round((j.total - done) / (done / elapsed));
  save(jobs);
}

function finish(id, status, { reason = null, cwd = process.cwd() } = {}) {
  const jobs = load();
  const j = find(jobs, id, cwd);
  if (!j) throw new Error(`No job called "${id}" in this folder.`);
  j.status = status;
  j.updatedAt = now();
  j.etaSec = null;
  if (status === 'done' && j.total) j.done = j.total;
  if (reason) j.reason = reason;
  save(jobs);
}

/** The job worth showing for a folder: newest running, else newest recent finish. */
function current(cwd, t = now()) {
  const mine = load().filter((j) => !cwd || j.cwd === cwd).sort((a, b) => b.updatedAt - a.updatedAt);
  const running = mine.find((j) => j.status === 'running');
  if (running) return running;
  const last = mine[0];
  if (!last) return null;
  if (last.status === 'done' && t - last.updatedAt < 30e3) return last;
  if (last.status === 'failed') return last;
  return null;
}

function fmtEta(sec) {
  if (sec == null) return '';
  if (sec < 60) return `${Math.max(1, sec)}s left`;
  if (sec < 3600) return `${Math.round(sec / 60)}m left`;
  return `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m left`;
}

/** One plain line for the band / status line. */
function line(j) {
  if (!j) return '';
  const count = j.total ? ` ${j.done}/${j.total}` : '';
  if (j.status === 'done') return `✓ ${j.label}${count}`;
  if (j.status === 'failed') return `✕ ${j.label}: ${j.reason || 'failed'}. Ask "what happened?"`;
  const bits = [`◐ ${j.label}${count}`];
  if (j.current) bits.push(j.current);
  const eta = fmtEta(j.etaSec);
  if (eta) bits.push(eta);
  return bits.join(' · ');
}

module.exports = { load, start, progress, finish, current, line, fmtEta };
