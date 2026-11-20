const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir, run } = require('./helpers');

const jobsOf = (home) => JSON.parse(fs.readFileSync(path.join(home, 'jobs.json'), 'utf8')).jobs;

test('start → progress → done, tagged with the folder', () => {
  const home = tmpdir();
  const cwd = tmpdir();
  const env = (t) => ({ CUTROOM_HOME: home, CUTROOM_NOW: String(t) });
  assert.equal(run('cutroom-job', ['start', 'px', 'Making proxies', '--total', '10'], { env: env(1000), cwd }).code, 0);
  run('cutroom-job', ['progress', 'px', '2', '--current', 'A01.mov'], { env: env(11000), cwd });
  let j = jobsOf(home)[0];
  assert.equal(j.cwd, cwd);
  assert.equal(j.label, 'Making proxies');
  assert.equal(j.done, 2);
  assert.equal(j.current, 'A01.mov');
  assert.equal(j.status, 'running');
  assert.equal(j.etaSec, 40); // 2 done in 10s → 8 left at 0.2/s
  run('cutroom-job', ['done', 'px'], { env: env(12000), cwd });
  j = jobsOf(home)[0];
  assert.equal(j.status, 'done');
  assert.equal(j.done, 10);
});

test('fail stores the reason', () => {
  const home = tmpdir();
  const env = { CUTROOM_HOME: home };
  run('cutroom-job', ['start', 'tx', 'Transcribing'], { env });
  run('cutroom-job', ['fail', 'tx', 'Whisper is not installed'], { env });
  const j = jobsOf(home)[0];
  assert.equal(j.status, 'failed');
  assert.equal(j.reason, 'Whisper is not installed');
});

test('same id in two folders are two jobs', () => {
  const home = tmpdir();
  const env = { CUTROOM_HOME: home };
  run('cutroom-job', ['start', 'px', 'A'], { env, cwd: tmpdir() });
  run('cutroom-job', ['start', 'px', 'B'], { env, cwd: tmpdir() });
  assert.equal(jobsOf(home).length, 2);
});

test('jobs older than 24h are pruned', () => {
  const home = tmpdir();
  const t0 = Date.parse('2026-01-01T00:00:00Z');
  run('cutroom-job', ['start', 'old', 'Old'], { env: { CUTROOM_HOME: home, CUTROOM_NOW: String(t0) } });
  run('cutroom-job', ['start', 'new', 'New'], { env: { CUTROOM_HOME: home, CUTROOM_NOW: String(t0 + 25 * 3600e3) } });
  assert.deepEqual(jobsOf(home).map((j) => j.id), ['new']);
});

test('unknown job id is a friendly error', () => {
  const r = run('cutroom-job', ['progress', 'nope', '1'], { env: { CUTROOM_HOME: tmpdir() } });
  assert.equal(r.code, 1);
  assert.match(r.err, /start/);
});
