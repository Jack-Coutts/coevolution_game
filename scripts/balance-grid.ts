/**
 * Small held-out probe for the default meadow. Seeds 100-109.
 *   npx tsx scripts/balance-grid.ts
 */
import { STABLE_PRESET } from '../src/game/presets'
import { deriveParams, type LeverValues } from '../src/sim/levers'
import type { EcoParams } from '../src/sim/params'
import { Sim } from '../src/sim/sim'

interface Patch {
  name: string
  levers?: Partial<LeverValues>
  eco?: Partial<EcoParams>
}

const PATCHES: Patch[] = [
  { name: 'now' },
  {
    name: 'fox-fuel',
    levers: {
      'pred.metabolism': 0.2,
      'pred.mealEnergy': 150,
      'pred.speedCost': 0.55,
      'pred.sense': 1.5,
      'pred.adultAge': 90,
      'pred.birthGap': 150,
      'pred.maxEnergy': 280,
    },
  },
  {
    name: 'fox-fuel-open',
    levers: {
      'pred.metabolism': 0.2,
      'pred.mealEnergy': 150,
      'pred.speedCost': 0.55,
      'pred.sense': 1.5,
      'pred.adultAge': 90,
      'pred.birthGap': 150,
      'habitat.cover': 3,
    },
    eco: { coverSight: 0.09, coverSlow: 0.85 },
  },
  {
    name: 'no-cover',
    levers: { 'habitat.cover': 0, 'pred.metabolism': 0.25, 'pred.mealEnergy': 130, 'pred.speedCost': 0.6 },
  },
  {
    name: 'fast-life',
    levers: {
      'prey.initial': 60,
      'prey.adultAge': 40,
      'prey.birthGap': 80,
      'prey.litter': 2,
      'pred.initial': 8,
      'pred.adultAge': 70,
      'pred.birthGap': 110,
      'pred.litter': 2,
      'pred.metabolism': 0.25,
      'pred.mealEnergy': 130,
      'pred.speedCost': 0.6,
      'food.sprout': 4,
      'evo.mutation': 0.08,
    },
  },
  {
    name: 'steady-food',
    levers: {
      'prey.initial': 50,
      'pred.initial': 8,
      'food.patches': 14,
      'food.regrow': 6,
      'food.sprout': 6,
      'pred.metabolism': 0.22,
      'pred.mealEnergy': 140,
      'pred.speedCost': 0.5,
      'pred.adultAge': 80,
      'pred.birthGap': 140,
    },
    eco: { cover: 4, coverSight: 0.08 },
  },
]

const seeds = Array.from({ length: 10 }, (_, i) => 100 + i)

function run(patch: Patch): void {
  const levers = { ...STABLE_PRESET, ...patch.levers }
  const p = deriveParams(levers)
  Object.assign(p.eco, patch.eco)
  let year = 0
  let starved = 0
  let old = 0
  const ticks: number[] = []
  let maxFox = 0
  for (const seed of seeds) {
    const s = new Sim(p, seed)
    let mf = 0
    while (s.step()) if (s.tick % 96 === 0) mf = Math.max(mf, s.preds.length)
    mf = Math.max(mf, s.preds.length)
    maxFox = Math.max(maxFox, mf)
    if (s.survived) year++
    starved += s.counters.predStarved
    old += s.counters.predOld
    ticks.push(s.tick)
  }
  ticks.sort((a, b) => a - b)
  const fox = starved + old
  console.log(
    `${patch.name.padEnd(16)} year ${year}/10  medTick ${ticks[4]}  maxFox ${maxFox}  starveShare ${fox ? (starved / fox).toFixed(2) : '-'}`,
  )
}

for (const patch of PATCHES) run(patch)
