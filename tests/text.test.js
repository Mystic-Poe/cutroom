const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir, run } = require('./helpers');

// A stand-in for osascript: answers "get" with a size and records every script.
function fakeOsascript(dir, size = '11') {
  const log = path.join(dir, 'calls.log');
  const bin = path.join(dir, 'osascript');
  fs.writeFileSync(bin, `#!/bin/sh\nprintf '%s\\n---\\n' "$*" >> "${log}"\ncase "$*" in *"get font size"*) echo ${size};; esac\n`, { mode: 0o755 });
  return { bin, log };
}
const envFor = (home, bin) => ({ CUTROOM_HOME: home, CUTROOM_OSASCRIPT: bin, CUTROOM_FORCE_MAC: '1' });

test('sets a bigger size and remembers the old one', () => {
  const home = tmpdir();
  const { bin, log } = fakeOsascript(tmpdir());
  const r = run('cutroom-text', ['18'], { env: envFor(home, bin) });
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /18/);
  assert.match(fs.readFileSync(log, 'utf8'), /set font size of default settings to 18/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, 'text.json'), 'utf8')).previous, 11);
});

test('a second change keeps the original size to go back to', () => {
  const home = tmpdir();
  const { bin } = fakeOsascript(tmpdir());
  run('cutroom-text', ['18'], { env: envFor(home, bin) });
  const { bin: bin2 } = fakeOsascript(tmpdir(), '18');
  run('cutroom-text', ['20'], { env: envFor(home, bin2) });
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, 'text.json'), 'utf8')).previous, 11);
});

test('reset puts the original size back', () => {
  const home = tmpdir();
  const { bin } = fakeOsascript(tmpdir());
  run('cutroom-text', ['18'], { env: envFor(home, bin) });
  const { bin: bin2, log: log2 } = fakeOsascript(tmpdir(), '18');
  const r = run('cutroom-text', ['reset'], { env: envFor(home, bin2) });
  assert.equal(r.code, 0, r.err);
  assert.match(fs.readFileSync(log2, 'utf8'), /to 11/);
});

test('refuses silly sizes and non-numbers', () => {
  const { bin } = fakeOsascript(tmpdir());
  assert.equal(run('cutroom-text', ['3'], { env: envFor(tmpdir(), bin) }).code, 2);
  assert.equal(run('cutroom-text', ['big; rm -rf x'], { env: envFor(tmpdir(), bin) }).code, 2);
});

test('off the Mac it explains instead of failing', () => {
  const r = run('cutroom-text', ['18'], { env: { CUTROOM_HOME: tmpdir(), CUTROOM_FORCE_MAC: '0' } });
  assert.equal(r.code, 0);
  assert.match(r.out, /Mac's Terminal/);
});
