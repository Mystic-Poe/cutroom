const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir, run } = require('./helpers');

function payload(over = {}) {
  return JSON.stringify({
    session_id: 's',
    model: { display_name: 'Opus' },
    workspace: { current_dir: '/E/AI-edits/nike_spot', project_dir: '/E/AI-edits/nike_spot' },
    context_window: { used_percentage: 34 },
    rate_limits: { five_hour: { used_percentage: 22 } },
    ...over,
  });
}
const env = (home, extra = {}) => ({ CUTROOM_HOME: home, NO_COLOR: '1', CUTROOM_RESOLVE_PROC: 'definitely-not-running-xyz', ...extra });

test('full payload: two calm lines', () => {
  const home = tmpdir();
  const r = run('cutroom-status', [], { env: env(home), input: payload() });
  assert.equal(r.code, 0, r.err);
  const lines = r.out.trimEnd().split('\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /nike_spot/);
  assert.match(lines[0], /Resolve ○/);
  assert.match(lines[1], /limit 22%/);
  assert.match(lines[1], /memory 34%/);
});

test('missing fields are left out, never an error', () => {
  const home = tmpdir();
  const r = run('cutroom-status', [], { env: env(home), input: JSON.stringify({ workspace: { current_dir: '/x/v1' } }) });
  assert.equal(r.code, 0);
  assert.match(r.out, /v1/);
  assert.doesNotMatch(r.out, /limit|memory|undefined|NaN/);
});

test('garbage stdin still prints something', () => {
  const r = run('cutroom-status', [], { env: env(tmpdir()), input: 'nope' });
  assert.equal(r.code, 0);
  assert.match(r.out, /cutroom/);
});

test('Resolve open, fresh timeline shown, stale timeline hidden', () => {
  const home = tmpdir();
  // stand-in for Resolve: a sleep process we start and stop ourselves
  const { spawn } = require('node:child_process');
  const fake = spawn('sleep', ['30']);
  test.after(() => fake.kill());
  const e = env(home, { CUTROOM_RESOLVE_PROC: 'sleep' });
  fs.writeFileSync(path.join(home, 'state.json'), JSON.stringify({ resolve: { timeline: 'Timeline v3', updatedAt: Date.now() }, higgsfield: { credits: 820, updatedAt: Date.now() } }));
  let r = run('cutroom-status', [], { env: e, input: payload() });
  assert.match(r.out, /Resolve ● Timeline v3/);
  assert.match(r.out, /Higgsfield 820 cr/);
  fs.writeFileSync(path.join(home, 'state.json'), JSON.stringify({ resolve: { timeline: 'Timeline v3', updatedAt: Date.now() - 600e3 } }));
  r = run('cutroom-status', [], { env: e, input: payload() });
  assert.match(r.out, /Resolve ●/);
  assert.doesNotMatch(r.out, /Timeline v3/);
});

test('drive free space for media roots', () => {
  const home = tmpdir();
  fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({ projectRoots: [], mediaRoots: [home] }));
  const r = run('cutroom-status', [], { env: env(home), input: payload() });
  assert.match(r.out, /free/);
});

test('shows the running job when the band is not drawing it', () => {
  const home = tmpdir();
  const cwd = '/E/AI-edits/nike_spot';
  fs.writeFileSync(path.join(home, 'jobs.json'), JSON.stringify({ jobs: [{ id: 'tx', label: 'Transcribing', cwd, total: 14, done: 4, current: 'A03.mov', status: 'running', startedAt: Date.now() - 1000, updatedAt: Date.now(), etaSec: 120 }] }));
  let r = run('cutroom-status', [], { env: env(home), input: payload() });
  assert.match(r.out, /Transcribing 4\/14/);
  fs.writeFileSync(path.join(home, 'band-alive'), String(Date.now()));
  r = run('cutroom-status', [], { env: env(home), input: payload() });
  assert.doesNotMatch(r.out, /Transcribing/);
});

test('limit turns into a warning at 80%', () => {
  const r = run('cutroom-status', [], { env: env(tmpdir()), input: payload({ rate_limits: { five_hour: { used_percentage: 91 } } }) });
  assert.match(r.out, /limit 91%/);
});

test('fast enough for a status line', () => {
  const home = tmpdir();
  const t = process.hrtime.bigint();
  run('cutroom-status', [], { env: env(home), input: payload() });
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  assert.ok(ms < 250, `took ${ms}ms`);
});

test('control characters never reach the terminal (security review)', () => {
  const home = tmpdir();
  const evil = '/x/v1\u001b]0;pwned\u0007\u001b[2J';
  fs.writeFileSync(path.join(home, 'jobs.json'), JSON.stringify({ jobs: [{ id: 'a', label: 'Job\u001b[31m', cwd: evil, status: 'running', startedAt: Date.now(), updatedAt: Date.now() }] }));
  const r = run('cutroom-status', [], { env: env(home), input: JSON.stringify({ workspace: { current_dir: evil } }) });
  assert.doesNotMatch(r.out, /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/);
});
