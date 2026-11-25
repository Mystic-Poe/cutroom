import { expect, test } from 'claude-code/testing'

import { ACTIONS, actionFor } from './actions'
import { EXAMPLES, folderName } from './screen'

const BAND = {
  plugin: 'cutroom',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

function engine(on: any, jobs: unknown[] = []) {
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('env.get', () => ({ value: '/home/ed' }))
  on('session.cwd', () => ({ value: '/E/AI-edits/nike_spot' }))
  on('clock.now', () => ({ value: 2_000 }))
  on('fs.read', () => ({ value: JSON.stringify({ jobs }) }))
  on('fs.write', () => ({ value: undefined }))
  on('clock.every', () => ({ value: { cancel() {} } }))
}

test('the folder name comes from the path the logo shows', () => {
  expect(folderName('/Volumes/Media/AI-edits/nike_spot')).toBe('nike_spot')
  expect(folderName('~/AI-edits/nike_spot/')).toBe('nike_spot')
  expect(folderName('')).toBe('this folder')
})

test('every quick action has its own digit and a request to send', () => {
  expect(ACTIONS.map(a => a.key)).toEqual(['1', '2', '3', '4'])
  for (const a of ACTIONS) expect(a.text.length > 0).toBe(true)
  // the cutting actions never cut or render without his OK
  for (const k of ['1', '3']) expect(actionFor(k)!.text).toMatch(/wait for my OK/)
  expect(actionFor('4')!.text.startsWith('/what-happened')).toBe(true)
})

test('the band shows the quick actions even when nothing is running', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/E/AI-edits/nike_spot', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const buttons = await ui.findAll({ type: 'Button' })
  expect(buttons.map((b: any) => b.props.label)).toEqual(ACTIONS.map(a => a.label))
  expect(buttons.map((b: any) => b.props.hotkey)).toEqual(['1', '2', '3', '4'])
  await ui.unmount()
})

test('pressing an action puts its request in the prompt box, and sends nothing', async ($, on) => {
  engine(on)
  const filled: string[] = []
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  on('prompt.fill', (_: unknown, e: any) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  on('prompt.submit', () => {
    throw new Error('an action must not send anything')
  })
  await $.session.start({ cwd: '/E/AI-edits/nike_spot', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'cutroom-action-1' })
  expect(filled).toEqual([actionFor('1')!.text])
  await ui.unmount()
})

test("an action never replaces a draft he's typing", async ($, on) => {
  engine(on)
  const filled: string[] = []
  const toasts: string[] = []
  on('prompt.read', () => ({ value: { text: 'cut the intro to', cursor: 16 } }))
  on('prompt.fill', (_: unknown, e: any) => {
    filled.push(e.text)
    return { isFilled: true }
  })
  on('ui.toast', (_: unknown, e: any) => {
    toasts.push(String(e.text ?? e))
    return { value: undefined }
  })
  await $.session.start({ cwd: '/E/AI-edits/nike_spot', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'cutroom-action-1' })
  expect(filled).toEqual([])
  expect(toasts.length).toBe(1)
  await ui.unmount()
})

test('a survey still gets the band to itself', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/E/AI-edits/nike_spot', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, hasSurvey: true }, surface: 'terminal' })
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  await ui.unmount()
})

test('the welcome card replaces the logo', async ($, on) => {
  engine(on)
  const ui = await $.ui.mount({
    plugin: 'cutroom',
    component: 'Welcome',
    surface: 'terminal',
    props: { version: '2.1.332', model: 'Opus', plan: 'Pro', cwd: '/E/AI-edits/nike_spot', agent: null, isLive: true },
  })
  expect(await ui.find({ type: 'Text', text: /nike_spot/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: new RegExp(EXAMPLES[0].slice(0, 12)) })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /cutroom-help/ })).toBeDefined()
  await ui.unmount()
})

test("Claude's questions are drawn as your-call cards", async ($, on) => {
  engine(on)
  const ui = await $.ui.mount({
    plugin: 'cutroom',
    component: 'AskUserQuestion',
    surface: 'terminal',
    props: { tool: 'AskUserQuestion', questions: [{ question: 'Which take?', header: 'Take', options: [{ label: 'A' }, { label: 'B' }], multiSelect: false }] },
  })
  expect(await ui.find({ type: 'Text', text: /Your call/ })).toBeDefined()
  await ui.unmount()
})

test('the turn timer is hidden in the normal view', async ($, on) => {
  engine(on)
  const mount = (props: Record<string, unknown>) =>
    $.ui.mount({ plugin: 'cutroom', component: 'TurnDuration', surface: 'terminal', props: { word: 'Baked', durationMs: 3000, ...props } })
  const ui = await mount({})
  expect(await ui.findAll({ type: 'Text' })).toHaveLength(0)
  await ui.unmount()
})
