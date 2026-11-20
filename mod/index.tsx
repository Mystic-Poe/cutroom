// cutroom's mod: the activity band above the prompt and plain-English tool rows.
import type { Register } from 'claude-code'

import { registerBand } from './band'
import { registerRows } from './rows'

export const register: Register = on => {
  registerBand(on)
  registerRows(on)
}
