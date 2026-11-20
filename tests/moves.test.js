const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir, run } = require('./helpers');

function setup() {
  const home = tmpdir();
  const d = tmpdir();
  const trash = path.join(d, '.Trash');
  fs.mkdirSync(trash);
  const env = { CUTROOM_HOME: home, CUTROOM_TRASH_DIR: trash };
  return { home, d, trash, env };
}
const lines = (home) => fs.readFileSync(path.join(home, 'moves.log'), 'utf8').trim().split('\n').map(JSON.parse);

test('mv moves a file and logs one batch', () => {
  const { home, d, env } = setup();
  fs.writeFileSync(path.join(d, 'a.mov'), 'A');
  const r = run('cutroom-mv', [path.join(d, 'a.mov'), path.join(d, 'b.mov')], { env });
  assert.equal(r.code, 0, r.err);
  assert.equal(fs.readFileSync(path.join(d, 'b.mov'), 'utf8'), 'A');
  assert.equal(fs.existsSync(path.join(d, 'a.mov')), false);
  const l = lines(home);
  assert.equal(l.length, 1);
  assert.equal(l[0].kind, 'move');
  assert.match(r.out, /Moved/);
});

test('mv refuses to overwrite and leaves both files', () => {
  const { d, env } = setup();
  fs.writeFileSync(path.join(d, 'a.mov'), 'A');
  fs.writeFileSync(path.join(d, 'b.mov'), 'B');
  const r = run('cutroom-mv', [path.join(d, 'a.mov'), path.join(d, 'b.mov')], { env });
  assert.equal(r.code, 1);
  assert.match(r.err, /already/);
  assert.equal(fs.readFileSync(path.join(d, 'b.mov'), 'utf8'), 'B');
  assert.equal(fs.readFileSync(path.join(d, 'a.mov'), 'utf8'), 'A');
});

test('mv several sources into a folder (created if needed)', () => {
  const { home, d, env } = setup();
  for (const n of ['1.mov', '2.mov']) fs.writeFileSync(path.join(d, n), n);
  const dest = path.join(d, 'clips', 'interviews') + '/';
  const r = run('cutroom-mv', [path.join(d, '1.mov'), path.join(d, '2.mov'), dest], { env });
  assert.equal(r.code, 0, r.err);
  assert.ok(fs.existsSync(path.join(dest, '1.mov')));
  assert.ok(fs.existsSync(path.join(dest, '2.mov')));
  const l = lines(home);
  assert.equal(l.length, 2);
  assert.equal(l[0].batch, l[1].batch);
});

test('mv with a missing source changes nothing', () => {
  const { d, env } = setup();
  fs.writeFileSync(path.join(d, '1.mov'), '1');
  const r = run('cutroom-mv', [path.join(d, '1.mov'), path.join(d, 'nope.mov'), path.join(d, 'out') + '/'], { env });
  assert.equal(r.code, 1);
  assert.ok(fs.existsSync(path.join(d, '1.mov')));
});

test('undo reverses the last batch only', () => {
  const { d, env } = setup();
  fs.writeFileSync(path.join(d, 'a.mov'), 'A');
  run('cutroom-mv', [path.join(d, 'a.mov'), path.join(d, 'b.mov')], { env });
  run('cutroom-mv', [path.join(d, 'b.mov'), path.join(d, 'c.mov')], { env });
  const r = run('cutroom-undo-move', [], { env });
  assert.equal(r.code, 0, r.err);
  assert.ok(fs.existsSync(path.join(d, 'b.mov')));
  assert.equal(fs.existsSync(path.join(d, 'c.mov')), false);
  const r2 = run('cutroom-undo-move', [], { env });
  assert.equal(r2.code, 0, r2.err);
  assert.ok(fs.existsSync(path.join(d, 'a.mov')));
});

test('undo refuses when the original spot is taken', () => {
  const { d, env } = setup();
  fs.writeFileSync(path.join(d, 'a.mov'), 'A');
  run('cutroom-mv', [path.join(d, 'a.mov'), path.join(d, 'b.mov')], { env });
  fs.writeFileSync(path.join(d, 'a.mov'), 'NEW');
  const r = run('cutroom-undo-move', [], { env });
  assert.equal(r.code, 1);
  assert.equal(fs.readFileSync(path.join(d, 'a.mov'), 'utf8'), 'NEW');
  assert.ok(fs.existsSync(path.join(d, 'b.mov')));
});

test('trash moves into the trash dir and logs; undo restores', () => {
  const { home, d, trash, env } = setup();
  fs.writeFileSync(path.join(d, 'bad.mov'), 'X');
  const r = run('cutroom-trash', [path.join(d, 'bad.mov')], { env });
  assert.equal(r.code, 0, r.err);
  assert.equal(fs.existsSync(path.join(d, 'bad.mov')), false);
  assert.equal(fs.readdirSync(trash).length, 1);
  assert.equal(lines(home)[0].kind, 'trash');
  const u = run('cutroom-undo-move', [], { env });
  assert.equal(u.code, 0, u.err);
  assert.equal(fs.readFileSync(path.join(d, 'bad.mov'), 'utf8'), 'X');
});

test('trash twice with the same name does not collide', () => {
  const { d, trash, env } = setup();
  fs.writeFileSync(path.join(d, 'x.mov'), '1');
  run('cutroom-trash', [path.join(d, 'x.mov')], { env });
  fs.writeFileSync(path.join(d, 'x.mov'), '2');
  const r = run('cutroom-trash', [path.join(d, 'x.mov')], { env });
  assert.equal(r.code, 0, r.err);
  assert.equal(fs.readdirSync(trash).length, 2);
});
