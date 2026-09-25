import type { Sim } from '@/sim/sim'
import { STAT, STAT_STRIDE } from './protocol'

/** One stats row as the game records it each hour. Shared with the scenario experiments (scripts/scenario-assay.ts). */
export function writeStats(s: Sim, out: Float64Array, row: number): void {
  const o = row * STAT_STRIDE
  const mean = (arr: { energy: number; pace: number; hunger: number }[], key: 'energy' | 'pace', max: number) =>
    arr.length ? arr.reduce((t, a) => t + a[key], 0) / arr.length / max : 0
  out[o + STAT.prey] = s.prey.length
  out[o + STAT.pred] = s.preds.length
  out[o + STAT.stock] = s.bushes.reduce((t, b) => t + b.stock, 0) / (s.p.patchStock * Math.max(1, s.bushes.length))
  out[o + STAT.bushes] = s.bushes.length
  out[o + STAT.preyEnergy] = mean(s.prey, 'energy', s.p.prey.maxEnergy)
  out[o + STAT.predEnergy] = mean(s.preds, 'energy', s.p.pred.maxEnergy)
  out[o + STAT.preyPace] = mean(s.prey, 'pace', 1)
  out[o + STAT.predPace] = mean(s.preds, 'pace', 1)
  const c = s.counters
  out[o + STAT.preyBorn] = c.preyBorn
  out[o + STAT.predBorn] = c.predBorn
  out[o + STAT.preyStarved] = c.preyStarved
  out[o + STAT.preyEaten] = c.preyEaten
  out[o + STAT.preyOld] = c.preyOld
  out[o + STAT.predStarved] = c.predStarved
  out[o + STAT.predOld] = c.predOld
  out[o + STAT.predCulled] = c.predCulled
  out[o + STAT.ceilingHits] = s.ceilingHits
  out[o + STAT.preySick] = s.prey.filter(a => a.illUntil > s.tick).length
  out[o + STAT.predSick] = s.preds.filter(a => a.illUntil > s.tick).length
  out[o + STAT.preyIllness] = c.preyIllness
  out[o + STAT.predIllness] = c.predIllness
  // mean distance of rabbits from their nearest bush: how spread out the prey are
  let spread = 0
  for (const a of s.prey) {
    let best = Infinity
    for (const b of s.bushes) best = Math.min(best, (b.x - a.x) ** 2 + (b.y - a.y) ** 2)
    spread += Math.sqrt(best)
  }
  out[o + STAT.preySpread] = s.prey.length ? spread / s.prey.length : 0
  out[o + STAT.predView] = s.preds.length ? s.preds.reduce((t, a) => t + a.view, 0) / s.preds.length : 0
}
