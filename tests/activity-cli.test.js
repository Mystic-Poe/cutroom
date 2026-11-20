const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir, run } = require('./helpers');

test('cutroom-activity prints this folder\'s story, oldest first, with moves', () => {
  const home = tmpdir();
  const cwd = tmpdir();
  const now = Date.now();
  const L = (o) => JSON.stringify(o) + '\n';
  fs.writeFileSync(path.join(home, 'activity.jsonl'),
    L({ ts: new Date(now - 3000).toISOString(), cwd, tool: 'Bash', summary: 'Check frame rates: ffprobe raw/A.mov', ok: true }) +
    L({ ts: new Date(now - 2000).toISOString(), cwd: '/other', tool: 'Bash', summary: 'elsewhere', ok: true }) +
    L({ ts: new Date(now - 1000).toISOString(), cwd, tool: 'Bash', summary: 'cutroom guard blocked: Deletes go through cutroom-trash', ok: false, guard: 'deny' }));
  fs.writeFileSync(path.join(home, 'moves.log'),
    L({ ts: new Date(now - 1500).toISOString(), batch: 'b1', kind: 'move', from: path.join(cwd, 'clips', 'A.mov'), to: path.join(cwd, 'clips', 'old', 'A.mov') }));
  const r = run('cutroom-activity', [], { env: { CUTROOM_HOME: home }, cwd });
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /Check frame rates/);
  assert.doesNotMatch(r.out, /elsewhere/);
  assert.match(r.out, /blocked/);
  assert.match(r.out, /moved .*A\.mov/i);
  assert.ok(r.out.indexOf('Check frame rates') < r.out.indexOf('blocked'));
});

test('cutroom-activity --all ignores the folder; empty log is friendly', () => {
  const home = tmpdir();
  const r = run('cutroom-activity', ['--all'], { env: { CUTROOM_HOME: home } });
  assert.equal(r.code, 0);
  assert.match(r.out, /Nothing/);
});
