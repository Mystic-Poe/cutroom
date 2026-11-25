// The quick actions in the band: a digit on an empty prompt puts a ready-made
// request in the prompt box. He reads it, changes it if he wants, and presses
// Enter. Nothing runs until he does.

export type Action = { key: string; label: string; text: string }

export const ACTIONS: readonly Action[] = [
  {
    key: '1',
    label: 'Rough cut',
    text:
      'Transcribe the footage in raw/ on this computer and propose cuts: silences, filler words, and earlier takes of repeated lines. ' +
      'Show me the cut list and wait for my OK before cutting anything.',
  },
  {
    key: '2',
    label: 'Find clips',
    text:
      'Read the transcript and find the 5 to 10 strongest moments for short clips. ' +
      'List each with its timecode and one line on why, and wait for me to pick.',
  },
  {
    key: '3',
    label: 'Render',
    text:
      'Render the finished timeline for every format I deliver. ' +
      'Tell me the formats and settings first and wait for my OK.',
  },
  { key: '4', label: 'What happened?', text: '/what-happened ' },
]

export const actionFor = (key: string): Action | undefined => ACTIONS.find(a => a.key === key)
