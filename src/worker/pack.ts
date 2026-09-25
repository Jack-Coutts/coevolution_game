import { inheritedTraits } from '@/sim/evolution'
import type { Sim } from '@/sim/sim'
import type { Species } from '@/sim/species'
import {
  ANIMAL_STRIDE,
  BUSH_STRIDE,
  EVENT_KIND,
  EVENT_SPECIES,
  EVENT_STRIDE,
  PLANT_EVENT,
  STAT,
  STAT_STRIDE,
  type EndInfo,
  type FrameData,
} from './protocol'

/** Packing of simulation state into frames and statistics rows, shared by the worker and scripts. */

function packAnimals(s: Sim, species: Species): Float32Array {
  const pop = s.pops[species]
  const sp = s.defs[species].body
  const out = new Float32Array(pop.length * ANIMAL_STRIDE)
  for (let i = 0; i < pop.length; i++) {
    const a = pop[i]
    const o = i * ANIMAL_STRIDE
    out[o] = a.id
    out[o + 1] = a.x
    out[o + 2] = a.y
    out[o + 3] = a.hx
    out[o + 4] = a.hy
    // Energy as a share of this animal's own maximum, so a small body is not shown as hungry.
    out[o + 5] = a.energy / a.maxEnergy
    out[o + 6] = Math.min(1, a.age / sp.adultAge)
    out[o + 7] = a.pace
    out[o + 8] = a.inCover ? 1 : 0
    out[o + 9] = a.gen
    out[o + 10] = a.age
    out[o + 11] = a.parent
    out[o + 12] = a.lineage
    out[o + 13] = a.kits
    out[o + 14] = a.view
    out[o + 15] = a.maxTurn
    out[o + 16] = a.brain.nHid
    const t = inheritedTraits(a.brain, species)
    out[o + 17] = t.forage
    out[o + 18] = t.flee
    out[o + 19] = t.cruise
    out[o + 20] = t.hide
    out[o + 21] = Math.max(0, a.illUntil - s.tick)
    out[o + 22] = a.size
  }
  return out
}

const SPROUT_HOURS = 48

function packBushes(s: Sim): Float32Array {
  const out = new Float32Array(s.bushes.length * BUSH_STRIDE)
  s.bushes.forEach((b, i) => {
    const o = i * BUSH_STRIDE
    out[o] = b.id
    out[o + 1] = b.x
    out[o + 2] = b.y
    out[o + 3] = b.stock / s.p.patchStock
    out[o + 4] = Math.min(1, b.age / SPROUT_HOURS)
    out[o + 5] = b.grazedFor / s.p.witherHours
  })
  return out
}

export function frame(s: Sim): FrameData {
  const events = new Float32Array(s.events.length * EVENT_STRIDE)
  s.events.forEach((e, i) => {
    const o = i * EVENT_STRIDE
    events[o] = EVENT_KIND.indexOf(e.kind)
    events[o + 1] = e.species === null ? PLANT_EVENT : EVENT_SPECIES.indexOf(e.species)
    events[o + 2] = e.x
    events[o + 3] = e.y
  })
  return {
    tick: s.tick,
    prey: packAnimals(s, 'prey'),
    preds: packAnimals(s, 'pred'),
    voles: packAnimals(s, 'vole'),
    bushes: packBushes(s),
    events,
  }
}

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
  const v = s.tally.vole
  out[o + STAT.vole] = s.voles.length
  out[o + STAT.voleEnergy] = mean(s.voles, 'energy', s.defs.vole.body.maxEnergy)
  out[o + STAT.voleBorn] = v.born
  out[o + STAT.voleStarved] = v.starved
  out[o + STAT.voleEaten] = v.eaten
  out[o + STAT.voleOld] = v.old
  out[o + STAT.voleIllness] = v.illness
  out[o + STAT.voleSick] = s.voles.filter(a => a.illUntil > s.tick).length
  out[o + STAT.seed] = s.p.vole && s.grassSeed.length
    ? s.grassSeed.reduce((t, n) => t + n, 0) / (s.p.vole.seedStock * s.grassSeed.length) : 0
}

export function endInfo(s: Sim): EndInfo | null {
  if (!s.ended) return null
  return { tick: s.tick, survived: s.survived, preyEnd: s.prey.length, predEnd: s.preds.length, voleEnd: s.voles.length, species: s.species }
}
