const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function tmpdir(prefix = 'cutroom-') {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

function run(bin, args = [], { input, env = {}, cwd } = {}) {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'bin', bin), ...args], {
    input, cwd, encoding: 'utf8', env: { ...process.env, ...env },
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

module.exports = { ROOT, tmpdir, run };
