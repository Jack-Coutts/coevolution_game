import type { SimParams } from '@/sim/params'
import type { Scenario } from '@/sim/scenarios'
import { dateLabel, formatDuration } from '@/sim/time'
import type { EndInfo } from '@/worker/protocol'
import type { RunHistory } from './history'

export type Tone = 'good' | 'info' | 'warn' | 'danger'

export interface Hint {
  id: string
  tone: Tone
  text: string
}

export interface Forecast {
  /** Projected counts HORIZON ticks ahead (from the log-linear trend of the recent window). */
  prey: number
  pred: number
  ahead: number
}

const WINDOW = 240
const AHEAD = 300

function trend(h: RunHistory, key: 'prey' | 'pred', tick: number): number {
  const from = Math.max(0, tick - WINDOW)
  const n = tick - from
  if (n < 24) return 0
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (let t = from; t <= tick; t += 4) {
    const y = Math.log(h.stat(t, key) + 1)
    sx += t
    sy += y
    sxx += t * t
    sxy += t * y
  }
  const m = Math.floor(n / 4) + 1
  const den = m * sxx - sx * sx
  return den === 0 ? 0 : (m * sxy - sx * sy) / den
}

export function forecast(h: RunHistory, tick: number): Forecast | null {
  if (tick < 48) return null
  const ahead = Math.min(AHEAD, h.horizon - tick)
  const project = (key: 'prey' | 'pred') => {
    const now = h.stat(tick, key)
    return Math.max(0, (now + 1) * Math.exp(trend(h, key, tick) * ahead) - 1)
  }
  return { prey: project('prey'), pred: project('pred'), ahead }
}

export function hints(h: RunHistory, tick: number, p: SimParams, cap: { prey: number; pred: number }): Hint[] {
  const out: Hint[] = []
  if (tick < 24) return out
  const prey = h.stat(tick, 'prey')
  const pred = h.stat(tick, 'pred')
  const past = Math.max(0, tick - WINDOW)
  const prey0 = h.stat(past, 'prey')
  const pred0 = h.stat(past, 'pred')
  const stock = h.stat(tick, 'stock')
  const predE = h.stat(tick, 'predEnergy')
  const preyE = h.stat(tick, 'preyEnergy')
  const energyWord = p.rules === 'energy' ? 'energy' : 'fullness'
  const preyGrowth = prey0 > 0 ? prey / prey0 - 1 : 0
  const predGrowth = pred0 > 0 ? pred / pred0 - 1 : 0

  if (preyGrowth > 0.4 && stock < 0.35) {
    out.push({
      id: 'boom',
      tone: 'warn',
      text: `Rabbits are up ${Math.round(preyGrowth * 100)}% in 10 days while bushes are only ${Math.round(stock * 100)}% full. A food crash is likely.`,
    })
  }
  if (pred > 0 && prey / pred < 5 && preyGrowth < -0.15) {
    out.push({
      id: 'overhunt',
      tone: 'danger',
      text: `Only ${(prey / pred).toFixed(1)} rabbits per fox, and rabbits are falling. The foxes may eat the warren out.`,
    })
  }
  if (pred > 0 && predE < 0.3) {
    out.push({
      id: 'foxhungry',
      tone: 'warn',
      text: `Foxes are running on empty (mean ${energyWord} ${Math.round(predE * 100)}%). Starvation is coming unless rabbits get easier to catch.`,
    })
  }
  if (prey > 0 && preyE < 0.3) {
    out.push({
      id: 'preyhungry',
      tone: 'warn',
      text: `Rabbits are underfed (mean ${energyWord} ${Math.round(preyE * 100)}%). Many will starve before they can breed.`,
    })
  }
  if (pred > 0 && pred <= 3) {
    out.push({ id: 'fewfox', tone: 'danger', text: `Only ${pred} fox${pred === 1 ? '' : 'es'} left. One bad week ends the run.` })
  }
  if (prey > 0 && prey <= 12) {
    out.push({ id: 'fewprey', tone: 'danger', text: `Only ${prey} rabbits left.` })
  }
  if (prey > 0 && stock < 0.12 && preyE >= 0.3) {
    out.push({
      id: 'bare',
      tone: 'info',
      text: `Bushes are nearly bare (${Math.round(stock * 100)}%). Rabbits eat every berry as it regrows, so food caps the warren.`,
    })
  }
  if (prey >= cap.prey - 1) {
    out.push({ id: 'preycap', tone: 'info', text: 'The warren is at its cap, so no rabbits can be born until some die.' })
  }
  if (pred >= cap.pred) {
    const kits = h.stat(tick, 'predBorn') - h.stat(past, 'predBorn')
    out.push({
      id: 'predcap',
      tone: 'info',
      text: `Foxes are at their cap of ${cap.pred}, so a kit is born only when an old fox dies (${kits} kit${kits === 1 ? '' : 's'} in the last 10 days).`,
    })
  }
  if (predGrowth > 0.5 && pred >= 6) {
    out.push({
      id: 'foxboom',
      tone: 'warn',
      text: `Foxes are up ${Math.round(predGrowth * 100)}% in 10 days. A boom like this is usually followed by a bust.`,
    })
  }
  const f = forecast(h, tick)
  if (f && tick + f.ahead < h.horizon) {
    if (pred > 0 && f.pred < 1) {
      out.push({
        id: 'fcfox',
        tone: 'danger',
        text: `At the current trend, foxes die out by about ${dateLabel(tick + f.ahead)}.`,
      })
    } else if (prey > 0 && f.prey < 1) {
      out.push({
        id: 'fcprey',
        tone: 'danger',
        text: `At the current trend, rabbits die out by about ${dateLabel(tick + f.ahead)}.`,
      })
    }
  }
  if (out.length === 0) {
    out.push({
      id: 'steady',
      tone: 'good',
      text: `Holding steady: ${prey} rabbits and ${pred} foxes, with bushes ${Math.round(stock * 100)}% full.`,
    })
  }
  return out
}

export interface Explanation {
  headline: string
  detail: string
  suggestions: string[]
}

function delta(h: RunHistory, key: Parameters<RunHistory['stat']>[1], from: number, to: number): number {
  return h.stat(to, key) - h.stat(from, key)
}

function avg(h: RunHistory, key: Parameters<RunHistory['stat']>[1], from: number, to: number): number {
  let s = 0
  let n = 0
  for (let t = from; t <= to; t++) {
    s += h.stat(t, key)
    n++
  }
  return n ? s / n : 0
}

function lastBirthTick(h: RunHistory, key: 'preyBorn' | 'predBorn', end: number): number | null {
  const total = h.stat(end, key)
  for (let t = end; t >= 0; t--) if (h.stat(t, key) < total) return t + 1
  return null
}

function inSpan(scenario: Scenario, tick: number): string | null {
  for (const s of scenario.spans) if (tick >= s.from && tick <= s.to) return s.label
  for (const m of scenario.markers) if (tick >= m.tick && tick - m.tick < 30 * 24) return m.label
  return null
}

export function explain(h: RunHistory, end: EndInfo, p: SimParams, scenario: Scenario): Explanation {
  const T = end.tick
  const when = `${dateLabel(T)} (day ${Math.floor(T / 24) + 1})`
  if (end.survived) {
    return {
      headline: `Both species made it through ${formatDuration(T)}.`,
      detail: `The meadow ended with ${end.preyEnd} rabbits and ${end.predEnd} foxes. ${h.stat(T, 'preyBorn')} rabbits and ${h.stat(T, 'predBorn')} foxes were born along the way.`,
      suggestions: ['Try a harder scenario, or win with more of the budget unspent for a higher score.'],
    }
  }
  const from = Math.max(0, T - 300)
  const context = inSpan(scenario, T)
  const ctx = context ? ` This happened during the ${context.toLowerCase()} period.` : ''
  if (end.predEnd === 0) {
    const starved = delta(h, 'predStarved', from, T)
    const old = delta(h, 'predOld', from, T)
    const preyAvg = avg(h, 'prey', from, T)
    const spread = avg(h, 'preySpread', from, T)
    const lastCub = lastBirthTick(h, 'predBorn', T)
    if (old > starved) {
      return {
        headline: `The last foxes died of old age on ${when}.`,
        detail: `No cub was born ${lastCub ? `after ${dateLabel(lastCub)}` : 'at all'}, so the old foxes had no successors.${ctx}`,
        suggestions: [
          p.rules === 'energy' ? 'Lower the fox breed threshold' : 'Lower the fox meals to breed',
          'Bring the fox first-birth age earlier',
          'Give foxes a longer lifespan',
        ],
      }
    }
    const reason =
      preyAvg < 25
        ? `there were too few rabbits to live on (about ${Math.round(preyAvg)} over the last 12 days)`
        : spread > 0.12
          ? `rabbits were too spread out to catch (${Math.round(preyAvg)} of them, scattered away from the bushes)`
          : `foxes could not catch the ${Math.round(preyAvg)} rabbits around them`
    return {
      headline: `Foxes starved on ${when}. ${reason.charAt(0).toUpperCase() + reason.slice(1)}.`,
      detail: `${starved} foxes starved and ${old} died of old age in their last 12 days.${ctx}`,
      suggestions:
        preyAvg < 25
          ? ['Give rabbits more food (bushes, regrowth)', 'Lower the fox cap so rabbits can rebuild', 'Start with more rabbits']
          : [
              p.rules === 'energy' ? 'Raise the energy per rabbit, or lower fox metabolism' : 'Lengthen the fox starvation time',
              'Widen the fox sense range',
              'Slow the rabbits (their max speed)',
            ],
    }
  }
  const eaten = delta(h, 'preyEaten', from, T)
  const starved = delta(h, 'preyStarved', from, T)
  const old = delta(h, 'preyOld', from, T)
  const ratio = avg(h, 'pred', from, T) / Math.max(1, avg(h, 'prey', from, T))
  if (eaten >= starved && eaten >= old) {
    return {
      headline: `Rabbits were eaten out on ${when}.`,
      detail: `${eaten} of the last ${eaten + starved + old} rabbit deaths were to foxes, with about 1 fox for every ${(1 / Math.max(ratio, 1e-6)).toFixed(1)} rabbits.${ctx}`,
      suggestions: ['Lower the fox cap', 'Raise the rabbit cap, or speed up rabbit breeding', 'Give rabbits more speed or sense range'],
    }
  }
  if (starved >= old) {
    const stock = avg(h, 'stock', from, T)
    return {
      headline: `Rabbits starved on ${when}. Bushes were ${stock < 0.3 ? 'grazed bare' : 'out of reach'}.`,
      detail: `${starved} rabbits starved in their last 12 days, with bushes averaging ${Math.round(stock * 100)}% full.${ctx}`,
      suggestions:
        stock < 0.3
          ? ['Add bushes or speed up regrowth', 'Lower the rabbit cap so they do not overgraze', 'Raise the energy per berry']
          : ['Lower rabbit metabolism or speed cost', 'Raise rabbit max energy'],
    }
  }
  return {
    headline: `The last rabbits died of old age on ${when}.`,
    detail: `Too few young were born to replace them.${ctx}`,
    suggestions: [
      p.rules === 'energy' ? 'Lower the rabbit breed threshold' : 'Lower the rabbit meals to breed',
      'Shorten the rabbit birth gap',
    ],
  }
}
