// The band above the prompt: what cutroom is doing right now, for this folder.
//   ◐ Transcribing 4/14 · interview_A03.mov · 2m left
// It only draws. It never approves or blocks anything (the guard does that).
import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { BandJob } from '../types'

const job = atom({ plugin: 'cutroom', key: 'job' } as const, null)

type Job = {
  id: string
  label: string
  cwd: string
  total: number | null
  done: number
  current: string | null
  status: 'running' | 'done' | 'failed'
  updatedAt: number
  etaSec: number | null
  reason: string | null
}

const clean = (s: unknown, n = 60): string => {
  const t = String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

const eta = (sec: number | null): string => {
  if (sec == null) return ''
  if (sec < 60) return `${Math.max(1, sec)}s left`
  if (sec < 3600) return `${Math.round(sec / 60)}m left`
  return `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m left`
}

// same rules as lib/jobs.js current() + line()
export function pick(jobs: Job[], cwd: string, now: number): BandJob | null {
  const mine = jobs.filter(j => j.cwd === cwd).sort((a, b) => b.updatedAt - a.updatedAt)
  const running = mine.find(j => j.status === 'running')
  const last = running ?? mine[0]
  if (!last) return null
  if (last.status === 'done' && now - last.updatedAt >= 30_000) return null
  const count = last.total ? ` ${last.done}/${last.total}` : ''
  const label = clean(last.label)
  if (last.status === 'done') return { text: `✓ ${label}${count}`, tone: 'done' }
  if (last.status === 'failed') return { text: `✕ ${label}: ${clean(last.reason || 'failed')}. Ask "what happened?"`, tone: 'failed' }
  const bits = [`◐ ${label}${count}`]
  if (last.current) bits.push(clean(last.current, 40))
  const left = eta(last.etaSec)
  if (left) bits.push(left)
  return { text: bits.join(' · '), tone: 'running' }
}

export const registerBand = (on: Parameters<Register>[0]) => {
  let timer: { cancel: () => void } | undefined
  let ticks = 0

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const home = (await $.env.get('CUTROOM_HOME')) ?? `${(await $.env.get('HOME')) ?? ''}/.cutroom`
    const tick = async () => {
      const now = await $.clock.now()
      let value: BandJob | null = null
      try {
        const cwd = await $.session.cwd()
        const data = JSON.parse(await $.fs.read(`${home}/jobs.json`))
        value = pick(Array.isArray(data?.jobs) ? data.jobs : [], cwd, now)
      } catch {
        value = null
      }
      const before = await read($, job)
      if (JSON.stringify(before) !== JSON.stringify(value)) await update($, job, () => value)
      // tell the status line the band is alive, so it doesn't show the job twice
      if (ticks++ % 5 === 0) await $.fs.write(`${home}/band-alive`, String(now)).catch(() => {})
    }
    timer?.cancel()
    timer = $.clock.every(1000, () => {
      void tick().catch(() => {})
    })
    void tick().catch(() => {})
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, job)
    if (e.props.hasSurvey || !current) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const color = current.tone === 'failed' ? 'text-danger' : current.tone === 'done' ? 'text-success' : 'text-accent'
    return (
      <Box>
        <Text color={color} wrap="truncate">
          {current.text}
        </Text>
      </Box>
    )
  })
}
