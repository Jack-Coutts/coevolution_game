import type { PopulationEvolution, TraitKey } from '@/sim/evolution'
import type { Scenario } from '@/sim/scenarios'
import { dateLabel, formatDuration } from '@/sim/time'
import type { EndInfo } from '@/worker/protocol'
import type { RunHistory } from './history'
import { BUDGET_POINT_BONUS, CALM_BONUS, type ScoreBreakdown } from './scores'

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
  /** 0 outside the Vole meadow. */
  vole: number
  ahead: number
}

const WINDOW = 240
const AHEAD = 300

function trend(h: RunHistory, key: 'prey' | 'pred' | 'vole', tick: number): number {
  const from = Math.max(h.firstTick, tick - WINDOW)
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
  if (tick - h.firstTick < 48) return null
  const ahead = Math.min(AHEAD, h.horizon - tick)
  const project = (key: 'prey' | 'pred' | 'vole') => {
    const now = h.stat(tick, key)
    return Math.max(0, (now + 1) * Math.exp(trend(h, key, tick) * ahead) - 1)
  }
  return { prey: project('prey'), pred: project('pred'), vole: h.species.includes('vole') ? project('vole') : 0, ahead }
}

const RANK: Record<Tone, number> = { danger: 0, warn: 1, info: 2, good: 3 }
/** A danger note stays this many hours after its condition last held, so a one-hour blip does not hide it. */
export const DANGER_HOLD = 48

/**
 * Field notes at `tick`, most urgent first. A danger note that held within the last DANGER_HOLD hours stays,
 * marked with how long ago it was last true.
 */
export function hints(h: RunHistory, tick: number): Hint[] {
  const out = notesAt(h, tick)
  // Once a species is gone there is nothing left to warn about, so old danger notes are not carried.
  const alive = h.stat(tick, 'prey') > 0 && h.stat(tick, 'pred') > 0 && (!h.species.includes('vole') || h.stat(tick, 'vole') > 0)
  for (let lag = 1; alive && lag <= DANGER_HOLD && tick - lag - h.firstTick >= 24; lag++) {
    for (const n of notesAt(h, tick - lag)) {
      if (n.tone !== 'danger' || out.some(o => o.id === n.id)) continue
      out.push({ ...n, text: `${n.text} (${lag} h ago)` })
    }
  }
  const alarms = out.filter(n => n.id !== 'steady' && n.id !== 'trend')
  return (alarms.length ? alarms : out).sort((a, b) => RANK[a.tone] - RANK[b.tone])
}

/** Red notes in `next` that were not in `prev`: what should stop the clock for a player who wants time to react. */
export function newDangers(prev: Hint[], next: Hint[]): Hint[] {
  const seen = new Set(prev.map(n => n.id))
  return next.filter(n => n.tone === 'danger' && !seen.has(n.id))
}

function notesAt(h: RunHistory, tick: number): Hint[] {
  const out: Hint[] = []
  if (tick - h.firstTick < 24) return out
  const prey = h.stat(tick, 'prey')
  const pred = h.stat(tick, 'pred')
  const past = Math.max(h.firstTick, tick - WINDOW)
  const prey0 = h.stat(past, 'prey')
  const pred0 = h.stat(past, 'pred')
  const stock = h.stat(tick, 'stock')
  const predE = h.stat(tick, 'predEnergy')
  const preyE = h.stat(tick, 'preyEnergy')
  const preyGrowth = prey0 > 0 ? prey / prey0 - 1 : 0
  const predGrowth = pred0 > 0 ? pred / pred0 - 1 : 0
  const voles = h.species.includes('vole')
  const vole = voles ? h.stat(tick, 'vole') : 0
  const vole0 = voles ? h.stat(past, 'vole') : 0
  const voleGrowth = vole0 > 0 ? vole / vole0 - 1 : 0
  if (voles) out.push(...voleNotes(h, tick, { vole, voleGrowth, pred, stock }))

  if (preyGrowth > 0.4 && stock < 0.35) {
    out.push({
      id: 'boom',
      tone: 'warn',
      text: `Rabbits are up ${Math.round(preyGrowth * 100)}% in 10 days while bushes are only ${Math.round(stock * 100)}% full. A food crash is likely.`,
    })
  }
  if (pred > 0 && prey > 0 && prey / pred < 5 && preyGrowth < -0.15) {
    out.push({
      id: 'overhunt',
      tone: 'danger',
      text: `Only ${(prey / pred).toFixed(1)} rabbits per fox, and rabbits are falling. The foxes may eat the warren out.${
        voles && vole >= 100 ? ` Foxes also keep the ${vole} voles in check: fewer foxes can mean a vole boom that strips the bushes.` : ''}`,
    })
  }
  if (pred > 0 && predE < 0.3) {
    out.push({
      id: 'foxhungry',
      tone: 'warn',
      text: `Foxes are running on empty (mean energy ${Math.round(predE * 100)}%). Starvation is coming unless rabbits get easier to catch.`,
    })
  }
  if (prey > 0 && preyE < 0.3) {
    out.push({
      id: 'preyhungry',
      tone: 'warn',
      text: `Rabbits are underfed (mean energy ${Math.round(preyE * 100)}%). Many will starve before they can breed.`,
    })
  }
  if (pred > 0 && pred <= 3) {
    out.push({ id: 'fewfox', tone: 'danger', text: `Only ${pred} fox${pred === 1 ? '' : 'es'} left. One bad week ends the run.` })
  }
  if (prey > 0 && prey <= 12) {
    out.push({ id: 'fewprey', tone: 'danger', text: `Only ${prey} rabbit${prey === 1 ? '' : 's'} left.` })
  }
  if (prey > 0 && stock < 0.12 && preyE >= 0.3) {
    out.push({
      id: 'bare',
      tone: 'info',
      text: `Bushes are nearly bare (${Math.round(stock * 100)}%). Rabbits eat every berry as it regrows, so food caps the warren.`,
    })
  }
  const kits = h.stat(tick, 'predBorn') - h.stat(past, 'predBorn')
  const foxOld = h.stat(tick, 'predOld') - h.stat(past, 'predOld')
  if (foxOld >= 1) {
    out.push({
      id: 'replace',
      tone: kits >= foxOld ? 'info' : 'warn',
      text:
        kits >= foxOld
          ? `Kits are replacing the foxes that die of old age (${kits} kits and ${Math.round(foxOld)} old-age deaths in 10 days).`
          : `Old foxes are dying faster than kits replace them (${kits} kits and ${Math.round(foxOld)} deaths of old age in 10 days).`,
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
    if (voles && vole > 0 && f.vole < 1 && pred > 0 && f.pred >= 1 && prey > 0 && f.prey >= 1) {
      out.push({
        id: 'fcvole',
        tone: 'danger',
        text: `At the current trend, voles die out by about ${dateLabel(tick + f.ahead)}.`,
      })
    } else if (pred > 0 && f.pred < 1) {
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
    // Only call it steady when the trend agrees; a forecast that halves or grows by half is not steady.
    const moving = (now: number, next: number) => (next + 1) / (now + 1) > 1.5 || (now + 1) / (next + 1) > 1.5
    if (f && f.ahead > 0 && (moving(prey, f.prey) || moving(pred, f.pred) || (voles && moving(vole, f.vole)))) {
      out.push({
        id: 'trend',
        tone: 'info',
        text: voles
          ? `No warnings yet, but the meadow is changing: at the current trend, about ${Math.round(f.prey)} rabbits, ${Math.round(f.vole)} voles and ${Math.round(f.pred)} foxes by ${dateLabel(tick + f.ahead)} (now ${prey}, ${vole} and ${pred}).`
          : `No warnings yet, but the meadow is changing: at the current trend, about ${Math.round(f.prey)} rabbits and ${Math.round(f.pred)} foxes by ${dateLabel(tick + f.ahead)} (now ${prey} and ${pred}).`,
      })
    } else {
      out.push({
        id: 'steady',
        tone: 'good',
        text: voles
          ? `Holding steady: ${prey} rabbits, ${vole} voles and ${pred} foxes, with bushes ${Math.round(stock * 100)}% full and grass seed ${Math.round(h.stat(tick, 'seed') * 100)}%.`
          : `Holding steady: ${prey} rabbits and ${pred} foxes, with bushes ${Math.round(stock * 100)}% full.`,
      })
    }
  }
  return out
}

/**
 * Vole meadow notes (docs/third-species.md section 8): grass seed running out, a vole plague,
 * a vole crash that will turn well-fed foxes onto rabbits, and few voles left.
 */
function voleNotes(h: RunHistory, tick: number, x: { vole: number; voleGrowth: number; pred: number; stock: number }): Hint[] {
  const out: Hint[] = []
  const { vole, voleGrowth, pred, stock } = x
  const seed = h.stat(tick, 'seed')
  if (vole > 0 && vole <= 15) {
    out.push({ id: 'fewvole', tone: 'danger', text: `Only ${vole} vole${vole === 1 ? '' : 's'} left. Voles recover fast from a few, but none means the run ends.` })
  }
  if (vole >= 30 && voleGrowth <= -0.4 && pred >= 10) {
    out.push({
      id: 'volecrash',
      tone: 'warn',
      text: `Voles are down ${Math.round(-voleGrowth * 100)}% in 10 days. The ${pred} foxes that lived on them will turn to rabbits.`,
    })
  }
  if (vole >= 120 && voleGrowth > 0.6) {
    out.push({
      id: 'voleboom',
      tone: 'warn',
      text: `Voles are up ${Math.round(voleGrowth * 100)}% in 10 days (${vole} now). When the grass seed runs out they will strip the bushes the rabbits need.`,
    })
  }
  if (vole > 0 && seed < 0.15) {
    out.push({
      id: 'seedlow',
      tone: stock < 0.3 ? 'warn' : 'info',
      text: `Grass seed is nearly gone (${Math.round(seed * 100)}%). Voles are moving to the berry bushes, where the rabbits feed.`,
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
  for (let t = end; t >= h.firstTick; t--) if (h.stat(t, key) < total) return t + 1
  return null
}

function inSpan(scenario: Scenario, tick: number): string | null {
  for (const s of scenario.spans) if (tick >= s.from && tick <= s.to) return s.label
  for (const m of scenario.markers) if (tick >= m.tick && tick - m.tick < 30 * 24) return m.label
  return null
}

export function explain(h: RunHistory, end: EndInfo, scenario: Scenario): Explanation {
  const T = end.tick
  const when = `${dateLabel(T)} (day ${Math.floor(T / 24) + 1})`
  const voles = end.species?.includes('vole') ?? false
  if (end.survived && voles) {
    return {
      headline: `All three species made it through ${formatDuration(T)}.`,
      detail: `The meadow ended with ${end.preyEnd} rabbits, ${end.voleEnd} voles and ${end.predEnd} foxes.`,
      suggestions: ['Win with more of the budget unspent for a higher score.'],
    }
  }
  if (end.survived) {
    return {
      headline: `Both species made it through ${formatDuration(T)}.`,
      detail: `The meadow ended with ${end.preyEnd} rabbits and ${end.predEnd} foxes. ${h.stat(T, 'preyBorn')} rabbits and ${h.stat(T, 'predBorn')} foxes were born along the way.`,
      suggestions: ['Try a harder scenario, or win with more of the budget unspent for a higher score.'],
    }
  }
  const from = Math.max(h.firstTick, T - 300)
  const context = inSpan(scenario, h.endless ? T % 8760 : T)
  const ctx = context ? ` This happened during the ${context.toLowerCase()} period.` : ''
  if (voles && end.voleEnd === 0 && end.preyEnd > 0 && end.predEnd > 0) return explainVoles(h, T, when, ctx, from)
  const species = end.predEnd === 0 ? 'pred' : 'prey'
  const illness = delta(h, species === 'pred' ? 'predIllness' : 'preyIllness', from, T)
  const other = delta(h, species === 'pred' ? 'predStarved' : 'preyStarved', from, T) +
    delta(h, species === 'pred' ? 'predOld' : 'preyOld', from, T) + (species === 'prey' ? delta(h, 'preyEaten', from, T) : 0)
  if (illness > 0 && illness >= other) return {
    headline: `${species === 'pred' ? 'Foxes' : 'Rabbits'} died out during illness on ${when}.`,
    detail: `${illness} animals ran out of energy while ill in the final observation window. Illness adds energy costs and spreads locally.${ctx}`,
    suggestions: ['Use illness earlier, while the population has a larger reserve', 'Prefer a precise fox cull when numbers are already low', 'Support food supplies while ill animals recover'],
  }
  if (end.predEnd === 0) {
    const starved = delta(h, 'predStarved', from, T)
    const volesEaten = voles ? delta(h, 'voleEaten', from, T) : 0
    const rabbitsEaten = delta(h, 'preyEaten', from, T)
    const old = delta(h, 'predOld', from, T)
    const preyAvg = avg(h, 'prey', from, T)
    const spread = avg(h, 'preySpread', from, T)
    const lastCub = lastBirthTick(h, 'predBorn', T)
    if (old > starved) {
      return {
        headline: `The last foxes died of old age on ${when}.`,
        detail: `No cub was born ${lastCub ? `after ${dateLabel(lastCub)}` : 'at all'}, so the old foxes had no successors.${ctx}`,
        suggestions: [
          'Lower the fox breed threshold',
          'Bring the fox first-birth age earlier',
          'Give foxes a longer lifespan',
        ],
      }
    }
    if (voles && starved >= old && avg(h, 'vole', from, T) < 40 && volesEaten + rabbitsEaten > 0 && volesEaten >= rabbitsEaten) {
      return {
        headline: `Foxes starved on ${when}, after the voles they lived on ran short.`,
        detail: `In their last 12 days foxes caught ${volesEaten} voles and ${rabbitsEaten} rabbits, about ${Math.round(preyAvg)} rabbits were around, and ${starved} foxes starved. A vole is a small meal, so a fox population built on voles collapses when they crash.${ctx}`,
        suggestions: ['Release voles before they crash', 'Keep rabbits numerous so foxes have a second food', 'Cull some foxes early when the voles start to fall, so the rest can live on rabbits'],
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
          ? ['Give rabbits more food (bushes, regrowth, sprout rate)', 'Start with fewer foxes', 'Start with more rabbits']
          : [
              'Raise the energy per rabbit, or lower fox metabolism',
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
      detail: `${eaten} of the last ${eaten + starved + old} rabbit deaths were to foxes, with ${ratio >= 1 ? `about ${ratio.toFixed(1)} foxes for every rabbit` : `about 1 fox for every ${(1 / Math.max(ratio, 1e-6)).toFixed(1)} rabbits`}.${ctx}`,
      suggestions: ['Start with fewer foxes', 'Speed up rabbit breeding', 'Give rabbits more speed or sense range'],
    }
  }
  if (starved >= old) {
    const stock = avg(h, 'stock', from, T)
    return {
      headline: `Rabbits starved on ${when}. Bushes were ${stock < 0.3 ? 'grazed bare' : 'out of reach'}.`,
      detail: `${starved} rabbits starved in their last 12 days, with bushes averaging ${Math.round(stock * 100)}% full.${ctx}`,
      suggestions:
        stock < 0.3
          ? ['Add bushes or speed up regrowth', 'Start with fewer rabbits so they do not overgraze', 'Raise the energy per berry']
          : ['Lower rabbit metabolism or speed cost', 'Raise rabbit max energy'],
    }
  }
  return {
    headline: `The last rabbits died of old age on ${when}.`,
    detail: `Too few young were born to replace them.${ctx}`,
    suggestions: [
      'Lower the rabbit breed threshold',
      'Shorten the rabbit birth gap',
    ],
  }
}

/** Voles died out while rabbits and foxes lived: name the main cause, as for rabbits. */
function explainVoles(h: RunHistory, T: number, when: string, ctx: string, from: number): Explanation {
  const eaten = delta(h, 'voleEaten', from, T)
  const starved = delta(h, 'voleStarved', from, T)
  const ill = delta(h, 'voleIllness', from, T)
  const old = delta(h, 'voleOld', from, T)
  const counts = `In their last 12 days ${starved} voles starved, ${eaten} were eaten by foxes, ${ill} ran out of energy while ill and ${old} died of old age.`
  if (ill > 0 && ill >= starved + eaten + old) return {
    headline: `Voles died out during illness on ${when}.`,
    detail: `${counts} Illness adds energy costs and spreads among nearby voles.${ctx}`,
    suggestions: ['Use vole illness only when voles are plentiful', 'Release voles to rebuild the population after illness'],
  }
  if (eaten >= starved && eaten >= old) {
    const ratio = avg(h, 'pred', from, T)
    return {
      headline: `Voles were eaten out on ${when}.`,
      detail: `${counts} About ${Math.round(ratio)} foxes were hunting them, with about ${Math.round(avg(h, 'prey', from, T))} rabbits as other food.${ctx}`,
      suggestions: ['Cull foxes when voles fall steeply', 'Release voles into the tall grass', 'Start with fewer foxes or more voles'],
    }
  }
  if (starved >= old) {
    const seed = avg(h, 'seed', from, T)
    const stock = avg(h, 'stock', from, T)
    return {
      headline: `Voles starved on ${when}. Grass seed was ${seed < 0.2 ? 'eaten bare' : 'not enough'}.`,
      detail: `${counts} Grass seed averaged ${Math.round(seed * 100)}% and bushes ${Math.round(stock * 100)}% full. Voles boom on seed, then starve when it runs out.${ctx}`,
      suggestions: ['More tall grass gives voles more seed (and rabbits more cover)', 'Rain refills the bushes voles fall back on', 'Release voles after a crash, when the seed has regrown'],
    }
  }
  return {
    headline: `The last voles died of old age on ${when}.`,
    detail: `${counts} Too few young were born to replace them.${ctx}`,
    suggestions: ['Release voles into the tall grass', 'Start with more voles'],
  }
}

/** The intervention allowance in words, shown next to the dots. */
export function usesLeft(charges: number, total: number, planning: boolean): string {
  if (planning) return `${total} uses per run`
  return charges === 0 ? `none of ${total} uses left` : `${charges} of ${total} uses left`
}

const n = (v: number) => v.toLocaleString('en-US')

/** The score as a sum in words, so a player can see what earned each part. */
export function scoreWords(score: ScoreBreakdown, survived: boolean, endless: boolean, interventions: number, speciesCount = 2): string {
  const hours = `${n(score.hours)} hours survived (one point per hour)`
  if (!survived) {
    return endless
      ? `Score ${n(score.total)} = ${hours}. In Endless the score is hours survived only.`
      : `Score ${n(score.total)} = ${hours}. The budget and calm bonuses count only when ${speciesCount === 2 ? 'both species last' : 'all species last'} the full year.`
  }
  const used = `${interventions} intervention${interventions === 1 ? '' : 's'} used`
  return `Score ${n(score.total)} = ${hours} + ${n(score.budgetBonus)} budget bonus (${BUDGET_POINT_BONUS} per unspent point) + ${n(score.calmBonus)} calm bonus (${CALM_BONUS[0]} with no interventions, 100 less for each; ${used}).`
}

/** A trait's headline value; a species with no animals has no trait, so do not show the empty mean (0.00). */
export function traitValue(pop: PopulationEvolution | undefined, trait: TraitKey): string {
  if (!pop) return '—'
  return pop.count === 0 ? 'none alive' : pop.traits[trait].mean.toFixed(2)
}

/** A playback rate in the speed buttons' units: "20 h/s", "3 d/s", "1.5 d/s". */
export function rateLabel(tps: number): string {
  if (tps < 23.5) return `${Math.max(0, Math.round(tps))} h/s`
  const days = Math.round((tps / 24) * 10) / 10
  return `${days} d/s`
}

/** The speed label, with the rate actually shown when the simulation cannot keep up. */
export function speedLabel(label: string, effectiveTps: number | null): string {
  return effectiveTps === null ? label : `${label} (running at ${rateLabel(effectiveTps)})`
}
