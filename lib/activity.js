'use strict';
// The activity log: one plain line per thing Claude did, for /what-happened.
const fs = require('node:fs');
const path = require('node:path');
const { file, appendJsonl, readJsonl } = require('./home');

const SKIP = new Set(['Read', 'Glob', 'Grep', 'LS', 'TodoWrite', 'TodoRead', 'ToolSearch', 'Skill', 'TaskOutput', 'ListMcpResourcesTool', 'ReadMcpResourceTool', 'AskUserQuestion', 'ExitPlanMode', 'EnterPlanMode']);
const MAX = 200;
const MONTH = 30 * 24 * 3600e3;

const clip = (s, n = MAX) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();

function summarize(tool, input) {
  const ti = input || {};
  if (tool === 'Bash') {
    const cmd = oneLine(ti.command);
    return ti.description ? `${oneLine(ti.description)}: ${cmd}` : cmd;
  }
  if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    return `${tool === 'Write' ? 'Wrote' : 'Edited'} ${ti.file_path || ti.notebook_path || 'a file'}`;
  }
  const m = /^mcp__(.+?)__(.+)$/.exec(tool);
  if (m) {
    const server = m[1].replace(/^claude_ai_/, '').replace(/^plugin_[^_]+_/, '');
    const keys = ['model', 'duration', 'resolution', 'aspect_ratio', 'name', 'timeline', 'path', 'file', 'count'];
    const bits = keys.filter((k) => ti[k] != null && typeof ti[k] !== 'object').map((k) => `${k} ${oneLine(ti[k])}`);
    if (ti.prompt) bits.push(`"${clip(oneLine(ti.prompt), 60)}"`);
    return `${server} ${m[2]}${bits.length ? ': ' + bits.join(', ') : ''}`;
  }
  if (tool === 'Agent' || tool === 'Task') return `Started a helper: ${oneLine(ti.description)}`;
  if (tool === 'WebFetch' || tool === 'WebSearch') return `${tool === 'WebFetch' ? 'Read' : 'Searched'} ${oneLine(ti.url || ti.query)}`;
  return tool;
}

function prune(p) {
  const marker = file('.activity-pruned');
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (fs.readFileSync(marker, 'utf8') === today) return;
  } catch { /* first run */ }
  const cutoff = Date.now() - MONTH;
  const keep = readJsonl(p).filter((e) => Date.parse(e.ts) >= cutoff);
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, keep.map((e) => JSON.stringify(e)).join('\n') + (keep.length ? '\n' : ''));
  fs.renameSync(tmp, p);
  fs.writeFileSync(marker, today);
}

function record(input) {
  const tool = input && input.tool_name;
  if (!tool || SKIP.has(tool)) return false;
  const p = file('activity.jsonl');
  if (fs.existsSync(p)) prune(p);
  const failed = input.hook_event_name === 'PostToolUseFailure' || (input.tool_response && input.tool_response.is_error === true);
  appendJsonl(p, {
    ts: new Date().toISOString(),
    session: input.session_id || null,
    cwd: input.cwd || null,
    tool,
    summary: clip(oneLine(summarize(tool, input.tool_input))),
    ok: !failed,
    ...(failed && input.error ? { error: clip(oneLine(input.error), 160) } : {}),
  });
  return true;
}

function forFolder(cwd, { since } = {}) {
  return readJsonl(file('activity.jsonl')).filter((e) => (!cwd || e.cwd === cwd || (e.cwd || '').startsWith(cwd + path.sep)) && (!since || Date.parse(e.ts) >= since));
}

module.exports = { record, summarize, forFolder };
