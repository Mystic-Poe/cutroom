// cutroom's mod: the Editor voice in every session, the activity band above
// the prompt, and plain-English tool rows.
import type { Register } from 'claude-code'

import { registerBand } from './band'
import { registerRows } from './rows'
import { registerVoice } from './voice'

export const register: Register = on => {
  registerVoice(on)
  registerBand(on)
  registerRows(on)
}
