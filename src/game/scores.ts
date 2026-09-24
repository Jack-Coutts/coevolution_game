import { BUDGET } from '@/sim/levers'
import type { RunConfig } from './controller'

export const BUDGET_POINT_BONUS = 10
/** Bonus for surviving the year with 0, 1, 2, 3 or all 4 interventions used. */
export const CALM_BONUS = [400, 300, 200, 100, 0]

export interface ScoreBreakdown {
  hours: number
  budgetBonus: number
  calmBonus: number
  total: number
}

/**
 * Bonuses only count for a full-year survival. Refunds only offset spending, so a run can
 * never earn more budget bonus than leaving every lever at its starting value.
 */
export function scoreRun(hours: number, survived: boolean, pointsSpent: number, interventions: number): ScoreBreakdown {
  const unspent = BUDGET - Math.max(0, pointsSpent)
  const budgetBonus = survived ? Math.round(BUDGET_POINT_BONUS * Math.max(0, unspent)) : 0
  const calmBonus = survived ? CALM_BONUS[Math.min(CALM_BONUS.length - 1, interventions)] : 0
  return { hours, budgetBonus, calmBonus, total: hours + budgetBonus + calmBonus }
}

export interface BestScore {
  score: number
  ticks: number
  at: string
}

const PREFIX = 'coevo-game:best:v2:'

function key(c: Pick<RunConfig, 'scenario' | 'seed'>): string {
  return `${PREFIX}${c.scenario}:${c.seed}`
}

function read(k: string): BestScore | null {
  try {
    const raw = localStorage.getItem(k)
    return raw ? (JSON.parse(raw) as BestScore) : null
  } catch {
    return null
  }
}

export function scoreFor(c: Pick<RunConfig, 'scenario' | 'seed'>): BestScore | null {
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
