// The rest of the screen: a cutroom welcome card in place of the logo, Claude's
// questions drawn as "your call" cards, and less chrome (the turn timer, the
// dim notices under the logo, the mode labels by the prompt).
// ctrl+o (the full transcript) still shows the turn timer.
import type { Register } from 'claude-code'

import { ACTIONS } from './actions'

export const EXAMPLES = [
  'What\'s in raw? Don\'t change anything.',
  'Make constant-frame-rate copies of the phone clips.',
  'Duplicate the timeline and add a marker at every speaker change.',
] as const

/** The video folder's name, from the path the logo shows. */
export function folderName(cwd: string): string {
  const parts = String(cwd ?? '').replace(/[\\/]+$/, '').split(/[\\/]/)
  return parts.pop() || 'this folder'
}

export const registerScreen = (on: Parameters<Register>[0]) => {
  on('ui.render', { component: 'Welcome' }, async ($, e, next) => {
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        <Text>
          <Text color="text-accent" weight="semibold">cutroom</Text>
          <Text color="text-muted">{'  ·  '}</Text>
          <Text>{folderName(e.props.cwd)}</Text>
        </Text>
        <Text color="text-muted">Ask in plain English. For example:</Text>
        {EXAMPLES.map(x => (
          <Text key={x} wrap="truncate">{`  “${x}”`}</Text>
        ))}
        <Text color="text-muted" wrap="truncate">
          {`Quick actions: type ${ACTIONS.map(a => a.key).join(', ')} on an empty prompt. More ideas: /cutroom-help`}
        </Text>
      </Box>
    )
  })

  on('ui.render', { component: 'AskUserQuestion' }, async ($, e, next) => {
    const { Box, Text } = $.ui.resolve(e)
    const engine = await next(e)
    return (
      <Box flexDirection="column">
        <Text color="text-accent" weight="semibold">◆ Your call</Text>
        <Text color="text-muted" wrap="truncate">Pick one, or type what you'd do instead.</Text>
        {engine}
      </Box>
    )
  })

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => {
    // keep "Waiting for 2 background agents…", and everything under ctrl+o
    if (e.props.isExpanded || e.props.waitingFor) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  on('ui.render', { component: 'InfoNotice' }, async ($, e, next) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => next({ ...e, props: { ...e.props, modes: [] } }))
}
