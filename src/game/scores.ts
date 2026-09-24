import type { RunConfig } from './controller'

export interface BestScore {
  score: number
  ticks: number
  at: string
}

const PREFIX = 'coevo-game:best:'

function key(c: Pick<RunConfig, 'scenario' | 'seed' | 'mode'>): string {
  return `${PREFIX}${c.scenario}:${c.seed}:${c.mode}`
}

function read(k: string): BestScore | null {
  try {
    const raw = localStorage.getItem(k)
    return raw ? (JSON.parse(raw) as BestScore) : null
  } catch {
    return null
  }
}

export function scoreFor(c: Pick<RunConfig, 'scenario' | 'seed' | 'mode'>): BestScore | null {
  return read(key(c))
}

export function recordScore(c: RunConfig, score: number, ticks: number): BestScore {
  const k = key(c)
  const prev = read(k)
  if (prev && prev.score >= score) return prev
  const next = { score, ticks, at: new Date().toISOString() }
  try {
    localStorage.setItem(k, JSON.stringify(next))
  } catch {
    /* storage unavailable (private mode): scores simply are not kept */
  }
  return next
}

/** The same seed for everyone on a given (local) day. */
export function dailySeed(d = new Date()): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}
