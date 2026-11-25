// cutroom's mod: the Editor voice in every session, the band above the prompt
// (running job and quick actions), plain-English tool rows, and a calmer screen.
import type { Register } from 'claude-code'

import { registerBand } from './band'
import { registerRows } from './rows'
import { registerScreen } from './screen'
import { registerVoice } from './voice'

export const register: Register = on => {
  registerVoice(on)
  registerBand(on)
  registerRows(on)
  registerScreen(on)
}
