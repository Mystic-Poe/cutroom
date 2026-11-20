const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { tmpdir } = require('./helpers');

test('expand ~', () => {
  const { expand } = require('../lib/config');
  assert.equal(expand('~/x'), path.join(os.homedir(), 'x'));
  assert.equal(expand('/a/b'), '/a/b');
});

test('isInside respects path boundaries', () => {
  const { isInside } = require('../lib/config');
  assert.equal(isInside('/a/b/c', ['/a/b']), true);
  assert.equal(isInside('/a/b', ['/a/b']), true);
  assert.equal(isInside('/a/bc', ['/a/b']), false);
  assert.equal(isInside('/x', []), false);
});

test('isLocked finds raw/ segments under a project root', () => {
  const { isLocked } = require('../lib/config');
  const cfg = { projectRoots: ['/E/AI-edits'], mediaRoots: [], lockedFolders: ['raw'] };
  assert.equal(isLocked('/E/AI-edits/v1/raw/A.mov', cfg), true);
  assert.equal(isLocked('/E/AI-edits/v1/raw', cfg), true);
  assert.equal(isLocked('/E/AI-edits/v1/clips/A.mov', cfg), false);
  assert.equal(isLocked('/E/AI-edits/v1/rawish/A.mov', cfg), false);
  assert.equal(isLocked('/elsewhere/raw/A.mov', cfg), false);
});

test('isLocked with no project roots locks any raw/ segment', () => {
  const { isLocked } = require('../lib/config');
  const cfg = { projectRoots: [], mediaRoots: [], lockedFolders: ['raw'] };
  assert.equal(isLocked('/anywhere/v1/raw/A.mov', cfg), true);
});

test('loadConfig defaults when missing, reads when present', () => {
  const home = tmpdir();
  process.env.CUTROOM_HOME = home;
  delete require.cache[require.resolve('../lib/config')];
  delete require.cache[require.resolve('../lib/home')];
  const { loadConfig } = require('../lib/config');
  assert.deepEqual(loadConfig(), { projectRoots: [], mediaRoots: [], lockedFolders: ['raw'] });
  fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({ projectRoots: ['~/AI-edits'], mediaRoots: ['/Volumes/M'] }));
  const cfg = loadConfig();
  assert.deepEqual(cfg.projectRoots, [path.join(os.homedir(), 'AI-edits')]);
  assert.deepEqual(cfg.lockedFolders, ['raw']);
  delete process.env.CUTROOM_HOME;
});

test('readJson / writeJsonAtomic / appendJsonl', () => {
  const { readJson, writeJsonAtomic, appendJsonl } = require('../lib/home');
  const d = tmpdir();
  const f = path.join(d, 'sub', 'a.json');
  writeJsonAtomic(f, { a: 1 });
  assert.deepEqual(readJson(f, null), { a: 1 });
  fs.writeFileSync(f, '{nope');
  assert.deepEqual(readJson(f, { fb: true }), { fb: true });
  assert.equal(readJson(path.join(d, 'missing.json'), 7), 7);
  const l = path.join(d, 'log.jsonl');
  appendJsonl(l, { x: 1 });
  appendJsonl(l, { x: 2 });
  assert.equal(fs.readFileSync(l, 'utf8').trim().split('\n').length, 2);
});
