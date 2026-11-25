import { expect, test } from 'claude-code/testing'

import { BASH_NOTE, FALLBACK, SECTION_ID, body, styleIsOn } from './voice'

const STYLE = '---\nname: Editor\nforce-for-plugin: true\n---\n\n# You are working with a video editor\n\nPlain English.\n'
const BASE = { sections: [{ id: 'intro', text: 'You are Claude Code.', scope: 'shared' }] }

function engine(on: any, read: () => unknown) {
  on('fs.read', read)
  on('prompt.compose', () => BASE)
  on('tool.describe', (_: unknown, e: any) => ({ description: e.description }))
}

const compose = ($: any, outputStyle: { name: string; isKeepingCodingInstructions: boolean } | null = null) =>
  $.prompt.compose({ model: 'm', promptModel: 'm', surfaces: ['terminal'], tools: ['Bash'], outputStyle, traits: [] })

test('the style body loses its frontmatter', () => {
  expect(body(STYLE)).toBe('# You are working with a video editor\n\nPlain English.')
  expect(body('no frontmatter')).toBe('no frontmatter')
})

test('the Editor voice is in the system prompt of every session', async ($, on) => {
  engine(on, () => ({ value: STYLE }))
  const { sections } = await compose($)
  expect(sections.map((s: any) => s.id)).toEqual(['intro', SECTION_ID])
  expect(sections[1].text).toBe(body(STYLE))
  expect(sections[1].scope).toBe('session')
})

test("it steps aside when Claude Code applied cutroom's output style", async ($, on) => {
  engine(on, () => ({ value: STYLE }))
  for (const name of ['Editor', 'cutroom:Editor']) {
    const { sections } = await compose($, { name, isKeepingCodingInstructions: true })
    expect(sections.map((s: any) => s.id)).toEqual(['intro'])
  }
  expect(styleIsOn({ name: 'Explanatory' })).toBe(false)
})

test('a missing style file still gives Claude the short version', async ($, on) => {
  engine(on, () => { throw new Error('ENOENT') })
  const { sections } = await compose($)
  expect(sections.at(-1).text).toBe(FALLBACK)
})

test('the Bash tool tells Claude the editor reads only the description', async ($, on) => {
  engine(on, () => ({ value: STYLE }))
  const r = await $.tool.describe({ tool: 'Bash', description: 'Runs a shell command.', provider: { plugin: 'engine', tier: 'core' } })
  expect(r.description).toBe('Runs a shell command.' + BASH_NOTE)
})
