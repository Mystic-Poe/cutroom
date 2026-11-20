import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'cutroom',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: true,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const job = (over: Record<string, unknown>) => ({
  id: 'tx', label: 'Transcribing', cwd: '/E/AI-edits/v1', total: 14, done: 4,
  current: 'A03.mov', status: 'running', updatedAt: 1_000, etaSec: 120, reason: null, ...over,
})

function engine(on: any, jobs: unknown[], cwd = '/E/AI-edits/v1') {
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('env.get', () => ({ value: '/home/ed' }))
  on('session.cwd', () => ({ value: cwd }))
  on('clock.now', () => ({ value: 2_000 }))
  on('fs.read', () => ({ value: JSON.stringify({ jobs }) }))
  on('fs.write', () => ({ value: undefined }))
  on('clock.every', () => ({ value: { cancel() {} } }))
}

test('shows the running job for this folder', async ($, on) => {
  engine(on, [job({})])
  await $.session.start({ cwd: '/E/AI-edits/v1', surface: 'terminal', isInteractive: true })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const row = await ui.find({ type: 'Text', text: /Transcribing/ })
    expect(row?.text).toBe('◐ Transcribing 4/14 · A03.mov · 2m left')
    await ui.unmount()
  }
})

test('ignores jobs from another folder', async ($, on) => {
  engine(on, [job({ cwd: '/E/AI-edits/other' })])
  await $.session.start({ cwd: '/E/AI-edits/v1', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Transcribing/ })).toBeUndefined()
  await ui.unmount()
})

test('a failed job says what to do next', async ($, on) => {
  engine(on, [job({ status: 'failed', reason: 'Whisper is not installed' })])
  await $.session.start({ cwd: '/E/AI-edits/v1', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const row = await ui.find({ type: 'Text', text: /what happened/ })
  expect(row?.text).toBe('✕ Transcribing: Whisper is not installed. Ask "what happened?"')
  await ui.unmount()
})
