// Plain-English wording for tool calls: one short sentence per action.
// Pure functions, so they're easy to test. The rows mod draws what these return.

export type Mark = '◐' | '✓' | '✕' | '■' | '·'
export type Tone = 'running' | 'done' | 'failed' | 'stopped'
export type Row = { mark: Mark; tone: Tone; text: string } | null

type Input = Record<string, unknown>

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

export const clean = (s: unknown, n = 90): string => {
  const t = String(s ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

const base = (p: unknown): string => {
  const s = str(p).replace(/\/+$/, '')
  return s.split('/').pop() || s || 'a file'
}

const sentenceCase = (s: string): string => {
  const t = s.replace(/[.\s]+$/, '')
  return t ? t[0].toUpperCase() + t.slice(1) : t
}

const humanize = (id: string): string => id.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()

// cutroom's own bookkeeping calls draw no row, but only a lone, plain
// invocation: anything chained onto it (; && | $( ) > < newline) still shows.
const SILENT = /^\s*cutroom-(job|log)(\s+("[^"`$\\]*"|'[^']*'|[\w./:@%+=,-]+))*\s*$/
const SHELL_OPS = /[;&|`\n\r<>]|\$\(/
const isSilent = (cmd: string): boolean => {
  const unquoted = cmd.replace(/'[^']*'/g, "''").replace(/"[^"`$\\]*"/g, '""')
  return SILENT.test(cmd) && !SHELL_OPS.test(unquoted)
}

const FIRST_WORD: Record<string, string> = {
  ffprobe: 'Checked the media details',
  mediainfo: 'Checked the media details',
  ffmpeg: 'Converted media',
  ls: 'Looked in a folder',
  find: 'Looked for files',
  cat: 'Read a file',
  head: 'Read a file',
  mkdir: 'Made a folder',
  'cp': 'Copied files',
  'cutroom-mv': 'Moved files',
  'cutroom-trash': 'Moved files to the Trash',
  'cutroom-undo-move': 'Put files back',
  'cutroom-doctor': 'Checked your setup',
  'cutroom-activity': 'Read the activity log',
  'cutroom-apply-settings': 'Updated cutroom settings',
  'cutroom-text': 'Changed the text size',
  brew: 'Installed software',
  npm: 'Installed software',
  npx: 'Ran a helper tool',
  git: 'Checked file history',
  osascript: 'Asked the Mac to do something',
  curl: 'Downloaded something',
  whisper: 'Transcribed audio',
  'whisper-cli': 'Transcribed audio',
  'auto-editor': 'Cut out silences',
}

function bashSentence(input: Input): string | null {
  const cmd = str(input.command)
  if (isSilent(cmd)) return null
  const d = str(input.description)
  if (d) return sentenceCase(clean(d))
  const word = (cmd.trim().split(/\s+/)[0] || '').split('/').pop() || ''
  return FIRST_WORD[word] ?? 'Ran a command'
}

function mcpSentence(tool: string, input: Input): string {
  const m = /^mcp__(.+?)__(.+)$/.exec(tool)
  if (!m) return humanize(tool)
  const server = m[1].toLowerCase()
  const name = humanize(m[2])
  const label = server.includes('higgsfield')
    ? 'Higgsfield'
    : server.includes('resolve') || server.includes('davinci')
      ? 'Resolve'
      : sentenceCase(humanize(m[1].replace(/^claude_ai_/, '').replace(/^plugin_[^_]+_/, '')))
  if (label === 'Resolve') {
    // Resolve's own server works through scripts: the row reads the script's
    // first plain comment, which the Editor voice asks Claude to write.
    if (/run_script/.test(m[2])) {
      const plan = /^\s*#\s*(.+)$/m.exec(str(input.script))
      return plan ? `Resolve: ${sentenceCase(clean(plan[1], 70))}` : 'Resolve: ran a script'
    }
    const quiet: Record<string, string> = {
      get_resolve_status: 'Resolve: checked it’s open',
      launch_resolve: 'Resolve: opened it',
      get_whats_new: 'Resolve: read what’s new',
      get_scripting_api: 'Resolve: looked up how to do it',
      search_scripting_api: 'Resolve: looked up how to do it',
      get_scripting_docs: 'Resolve: looked up how to do it',
      list_luts: 'Resolve: listed the looks',
      list_dctls: 'Resolve: listed the looks',
      generate_lut: 'Resolve: made a look (LUT)',
      update_dctl: 'Resolve: made a look (DCTL)',
      delete_lut: 'Resolve: deleted a look',
      delete_dctl: 'Resolve: deleted a look',
    }
    if (quiet[m[2]]) return quiet[m[2]]
  }
  const bits: string[] = []
  for (const k of ['model', 'duration', 'name', 'timeline']) {
    const v = input[k]
    if (typeof v === 'number' && k === 'duration') bits.push(`${v}s`)
    else if (typeof v === 'string' || typeof v === 'number') bits.push(clean(v, 30))
  }
  return `${label}: ${name}${bits.length ? ` (${bits.join(', ')})` : ''}`
}

/** The sentence for one call, or null for a call that draws no row. */
export function sentence(tool: string, raw: unknown): string | null {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Input
  switch (tool) {
    case 'Bash':
      return bashSentence(input)
    case 'Read':
      return `Looked at ${base(input.file_path)}`
    case 'Write':
      return `Saved ${base(input.file_path)}`
    case 'Edit':
    case 'MultiEdit':
      return `Updated ${base(input.file_path)}`
    case 'NotebookEdit':
      return `Updated ${base(input.notebook_path)}`
    case 'Glob':
      return 'Looked for files'
    case 'Grep':
      return str(input.pattern) ? `Searched inside files for "${clean(input.pattern, 40)}"` : 'Searched inside files'
    case 'WebFetch': {
      const host = /^https?:\/\/([^/]+)/.exec(str(input.url))
      return `Read a web page${host ? ` (${host[1]})` : ''}`
    }
    case 'WebSearch':
      return `Searched the web for "${clean(input.query, 50)}"`
    case 'Agent':
    case 'Task':
      return `Asked a helper to ${clean(str(input.description) || 'help', 60).replace(/^./, (c) => c.toLowerCase())}`
    case 'TodoWrite':
      return 'Updated the to-do list'
    case 'Skill':
      return `Used the ${clean(input.skill || input.name, 40)} skill`
    case 'ToolSearch':
      return null
    default:
      return tool.startsWith('mcp__') ? mcpSentence(tool, input) : sentenceCase(humanize(tool))
  }
}

/** First useful line of an error or refusal, in plain words. */
export function failure(output: unknown): { stopped: boolean; text: string } {
  const text = typeof output === 'string' ? output : output && typeof output === 'object' ? JSON.stringify(output) : ''
  const hook = /hook (?:error|blocked)[^:]*:\s*([\s\S]*)/i.exec(text)
  if (hook || /cutroom/i.test(text)) {
    const why = clean((hook ? hook[1] : text).replace(/`/g, '').split(/(?<=[.!?])\s/)[0], 80)
    return { stopped: true, text: `cutroom stopped this: ${why.replace(/\.$/, '')}` }
  }
  if (/doesn.t want to proceed|user (?:rejected|denied|declined)|permission.*denied by user/i.test(text)) {
    return { stopped: true, text: 'You said no, so it was skipped' }
  }
  const line =
    text
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !/^exit code \d+$/i.test(l) && !/^error:?$/i.test(l)) || ''
  return { stopped: false, text: line ? clean(line.replace(/^(error|fatal):\s*/i, ''), 80) : "it didn't work" }
}

export type Call = { tool: string; input: unknown; isRunning: boolean; isErrored: boolean; isInterrupted: boolean; output?: unknown }

/** One row for a call. */
export function row(c: Call): Row {
  const s = sentence(c.tool, c.input)
  if (s === null) return null
  if (c.isInterrupted) return { mark: '■', tone: 'stopped', text: `${s} (stopped)` }
  if (c.isRunning) return { mark: '◐', tone: 'running', text: s }
  if (c.isErrored) {
    const f = failure(c.output)
    return f.stopped ? { mark: '■', tone: 'stopped', text: f.text } : { mark: '✕', tone: 'failed', text: `${s}: ${f.text}` }
  }
  return { mark: '✓', tone: 'done', text: s }
}

const KIND: Record<string, [string, string]> = {
  Read: ['looked at 1 file', 'looked at {n} files'],
  Glob: ['looked for files', 'looked for files {n} times'],
  Grep: ['searched inside files', 'searched inside files {n} times'],
  Bash: ['did 1 step', 'did {n} steps'],
  WebFetch: ['read a web page', 'read {n} web pages'],
  WebSearch: ['searched the web', 'searched the web {n} times'],
}

/** One line for a folded group of quick calls. */
export function groupLine(calls: ReadonlyArray<Call>, isActive: boolean): Row {
  const visible = calls.filter((c) => sentence(c.tool, c.input) !== null)
  if (!visible.length) return null
  const bad = visible.filter((c) => c.isErrored || c.isInterrupted)
  // a short run reads best as Claude's own sentences
  if (visible.length <= 2) {
    const text = visible.map((c) => sentence(c.tool, c.input)!).join(', then ').replace(/, then (.)/g, (_m, ch) => `, then ${ch.toLowerCase()}`)
    if (bad.length) {
      const f = failure(bad[0].output)
      return f.stopped ? { mark: '■', tone: 'stopped', text: f.text } : { mark: '✕', tone: 'failed', text: `${text}: ${f.text}` }
    }
    if (isActive && visible.some((c) => c.isRunning)) return { mark: '◐', tone: 'running', text }
    return { mark: '✓', tone: 'done', text }
  }
  const counts = new Map<string, number>()
  for (const c of visible) counts.set(c.tool, (counts.get(c.tool) ?? 0) + 1)
  const parts = [...counts].map(([tool, n]) => {
    const k = KIND[tool]
    if (k) return (n === 1 ? k[0] : k[1]).replace('{n}', String(n))
    return n === 1 ? (sentence(tool, visible.find((c) => c.tool === tool)!.input) ?? tool).toLowerCase() : `${n} ${humanize(tool).toLowerCase()} steps`
  })
  const text = sentenceCase(parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0])
  if (bad.length) {
    const f = failure(bad[0].output)
    return f.stopped
      ? { mark: '■', tone: 'stopped', text: `${text}. ${f.text}` }
      : { mark: '✕', tone: 'failed', text: `${text}. One step didn't work: ${f.text}` }
  }
  if (isActive && visible.some((c) => c.isRunning)) return { mark: '◐', tone: 'running', text }
  return { mark: '✓', tone: 'done', text }
}
