// The Editor voice, in every session the plugin is enabled in.
//
// cutroom ships its voice as an output style with `force-for-plugin: true`, but
// Claude Code doesn't reliably register plugin output styles (anthropics/claude-code
// #64914, #89774), so the voice only reached Claude inside cutroom's own commands.
// This mod adds the same text to the system prompt itself, so it doesn't depend
// on the output style loading. If the style does load, this steps aside.
//
// It also tells Claude, in the Bash tool's own description, to write a plain
// sentence for every command, because the tool rows draw that sentence.
import type { Register } from 'claude-code'

export const SECTION_ID = 'cutroom:editor'

export const BASH_NOTE =
  '\n\nThe person reading these rows is a video editor, not a programmer. They see only your `description`, never the command. ' +
  'Always set `description` to one short plain-English sentence about the result, such as "Check the frame rate of 3 clips". ' +
  'No flags, long paths or tool names they would not know.'

// Used only if the style file can't be read.
export const FALLBACK = [
  '# You are working with a video editor',
  'They edit in DaVinci Resolve Studio on a Mac and are not a programmer. Write in plain English and keep messages short.',
  'Before a multi-step action, say in one line what and why. After it, say what changed, where, and how to undo.',
  'Work on your own and stop only at creative decisions (which take, pacing, look, music, titles, approving a cut list), with 2–3 options and a recommendation.',
  'Every Bash command needs a plain-English `description`; the editor sees only that.',
  'Move with `cutroom-mv`, delete with `cutroom-trash`, never overwrite footage, and report long jobs with `cutroom-job`.',
].join('\n')

/** The style file's body, without its frontmatter. */
export function body(md: string): string {
  const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(md)
  return (m ? md.slice(m[0].length) : md).trim()
}

/** True when Claude Code already applied cutroom's output style. */
export const styleIsOn = (style: { name: string } | null | undefined): boolean =>
  !!style && /(^|:)editor$/i.test(style.name.trim())

let editor: string | null = null

async function load($: any): Promise<string> {
  if (editor) return editor
  try {
    editor = body(await $.fs.read(`${$.plugin.root}/output-styles/editor.md`)) || FALLBACK
  } catch {
    editor = FALLBACK
  }
  return editor
}

export const registerVoice = (on: Parameters<Register>[0]) => {
  // the style file is read on the first prompt, then kept
  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    if (styleIsOn(e.outputStyle) || result.sections.some(s => s.id === SECTION_ID)) return result
    const text = await load($)
    return { ...result, sections: [...result.sections, { id: SECTION_ID, text, scope: 'session' as const }] }
  })

  on('tool.describe', { tool: 'Bash' }, async ($, e, next) => {
    const result = await next(e)
    if (result.description.includes(BASH_NOTE.trim().slice(0, 40))) return result
    return { ...result, description: result.description + BASH_NOTE }
  })
}
