const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir, run } = require('./helpers');

const read = (home) => fs.readFileSync(path.join(home, 'activity.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);

test('logs Bash, Write and MCP actions in plain one-liners', () => {
  const home = tmpdir();
  const env = { CUTROOM_HOME: home };
  const base = { session_id: 's1', cwd: '/E/AI-edits/v1', hook_event_name: 'PostToolUse' };
  run('cutroom-log', [], { env, input: JSON.stringify({ ...base, tool_name: 'Bash', tool_input: { command: 'ffmpeg -n -i raw/A.mov clips/A.mp4', description: 'Convert A to constant frame rate' } }) });
  run('cutroom-log', [], { env, input: JSON.stringify({ ...base, tool_name: 'Write', tool_input: { file_path: '/E/AI-edits/v1/cutlist.md', content: 'x' } }) });
  run('cutroom-log', [], { env, input: JSON.stringify({ ...base, tool_name: 'mcp__claude_ai_Higgsfield__generate_video', tool_input: { model: 'kling-3.0', duration: 5, prompt: 'a'.repeat(500) } }) });
  const l = read(home);
  assert.equal(l.length, 3);
  assert.equal(l[0].tool, 'Bash');
  assert.match(l[0].summary, /Convert A to constant frame rate/);
  assert.match(l[0].summary, /ffmpeg/);
  assert.equal(l[0].ok, true);
  assert.equal(l[0].session, 's1');
  assert.match(l[1].summary, /cutlist\.md/);
  assert.match(l[2].summary, /Higgsfield/i);
  assert.match(l[2].summary, /kling-3\.0/);
  for (const e of l) assert.ok(e.summary.length <= 200);
});

test('failures are marked not ok', () => {
  const home = tmpdir();
  run('cutroom-log', [], { env: { CUTROOM_HOME: home }, input: JSON.stringify({ hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', tool_input: { command: 'false' }, error: 'exit 1', cwd: '/x' }) });
  assert.equal(read(home)[0].ok, false);
});

test('read-only noise is not logged', () => {
  const home = tmpdir();
  for (const t of ['Read', 'Glob', 'Grep', 'TodoWrite', 'ToolSearch'])
    run('cutroom-log', [], { env: { CUTROOM_HOME: home }, input: JSON.stringify({ tool_name: t, tool_input: {}, cwd: '/x' }) });
  assert.equal(fs.existsSync(path.join(home, 'activity.jsonl')), false);
});

test('garbage input never fails the hook', () => {
  const r = run('cutroom-log', [], { env: { CUTROOM_HOME: tmpdir() }, input: 'nope' });
  assert.equal(r.code, 0);
});

test('entries older than 30 days are pruned', () => {
  const home = tmpdir();
  const old = { ts: '2020-01-01T00:00:00.000Z', tool: 'Bash', summary: 'old', ok: true };
  fs.writeFileSync(path.join(home, 'activity.jsonl'), JSON.stringify(old) + '\n');
  run('cutroom-log', [], { env: { CUTROOM_HOME: home }, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls' }, cwd: '/x' }) });
  const l = read(home);
  assert.equal(l.length, 1);
  assert.notEqual(l[0].summary, 'old');
});
