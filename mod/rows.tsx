// Plain-English tool rows: each action draws as one calm line.
//   ✓ Checked the frame rate of 3 clips
//   ✕ Transcribe A03.mov: Whisper isn't installed
//   ■ cutroom stopped this: Deletes go through cutroom-trash
// ctrl+o (or --verbose) still shows every real command and its output.
import type { Register } from 'claude-code'

import { groupLine, row } from './plain'
import type { Row } from './plain'

const COLOR = { running: 'text-accent', done: 'text-success', failed: 'text-danger', stopped: 'text-warning' } as const

function draw($: any, e: any, r: Row) {
  const { Box, Text } = $.ui.resolve(e)
  if (!r) return <Box />
  return (
    <Box>
      <Text color={COLOR[r.tone]}>{r.mark} </Text>
      <Text wrap="truncate">{r.text}</Text>
    </Box>
  )
}

export const registerRows = (on: Parameters<Register>[0]) => {
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const p = e.props
    if (p.isExpanded) return next(e)
    return draw($, e, row({ tool: p.tool, input: p.input, isRunning: p.isRunning, isErrored: p.isErrored, isInterrupted: p.isInterrupted, output: p.output }))
  })

  // results live in the row's one line; ctrl+o shows the real output
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.props.isExpanded) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    const p = e.props
    if (p.isExpanded) return next(e)
    return draw($, e, groupLine(p.calls as any, p.isActive))
  })
}
