// cutroom's mod state: the one job line the band above the prompt shows.
export type BandJob = { text: string; tone: 'running' | 'done' | 'failed' }

declare module 'claude-code' {
  interface PluginState {
    cutroom: { job: BandJob | null }
  }
}
