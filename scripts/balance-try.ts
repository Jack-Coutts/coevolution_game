/** Trace one seed, or score a handful of extreme patches. */
import { STABLE_PRESET } from '../src/game/presets'
import { deriveParams, type LeverValues } from '../src/sim/levers'
import type { EcoParams } from '../src/sim/params'
import { Sim } from '../src/sim/sim'
import { calendar } from '../src/sim/time'

const mode = process.argv[2] ?? 'trace'

const SLOW = {
  'pred.metabolism': 0.15,
  'pred.mealEnergy': 110,
  'pred.speedCost': 0.9,
  'pred.speed': 0.8,
  'prey.speed': 1.25,
  'prey.litter': 2,
  'prey.adultAge': 50,
  'prey.birthGap': 90,
}

if (mode === 'trace') {
  const p = deriveParams(STABLE_PRESET)
  const s = new Sim(p, 100)
  let maxF = 0
  while (s.step()) {
    maxF = Math.max(maxF, s.preds.length)
    if (s.tick % 200 === 0) {
      const stock = s.bushes.reduce((t, b) => t + b.stock, 0)
      console.log(
        `t=${s.tick} rabbits=${s.prey.length} foxes=${s.preds.length} bushes=${s.bushes.length} berries=${stock} foxStarve=${s.counters.predStarved} foxOld=${s.counters.predOld}`,
      )
    }
  }
  console.log('end', s.tick, 'survived', s.survived, 'maxFox', maxF, s.counters)
} else if (mode === 'detail') {
  const p = deriveParams({ ...STABLE_PRESET, ...SLOW })
  p.pred.visionUpkeep = 0.05
  for (let seed = 100; seed < 110; seed++) {
    const s = new Sim(p, seed)
    let maxFox = 0
    let maxPrey = 0
    while (s.step()) {
      maxFox = Math.max(maxFox, s.preds.length)
      maxPrey = Math.max(maxPrey, s.prey.length)
    }
    const cal = calendar(s.tick)
    const fox = s.counters.predStarved + s.counters.predOld
    console.log(
      `seed ${seed} ${s.survived ? 'YEAR' : cal.monthName} t=${s.tick} prey=${s.prey.length} fox=${s.preds.length} maxPrey=${maxPrey} maxFox=${maxFox} starve=${s.counters.predStarved} old=${s.counters.predOld} share=${fox ? (s.counters.predStarved / fox).toFixed(2) : '-'}`,
    )
  }
} else {
  const patches: { name: string; levers?: LeverValues; eco?: Partial<EcoParams>; wither?: number; vision?: number }[] = [
    { name: 'rabbits-120', vision: 0.05, levers: { ...SLOW, 'prey.initial': 120 } },
    { name: 'slower', vision: 0.05, levers: { ...SLOW, 'pred.speed': 0.75 } },
    { name: 'sprint-cost', vision: 0.05, levers: { ...SLOW, 'pred.speedCost': 1.3 } },
    { name: 'rabbit-eyes', vision: 0.05, levers: { ...SLOW, 'prey.sense': 1.3, 'prey.initial': 120 } },
    { name: '120-slow-sprint', vision: 0.05, levers: { ...SLOW, 'prey.initial': 120, 'pred.speed': 0.75, 'pred.speedCost': 1.2 } },
  ]
  for (const patch of patches) {
    const p = deriveParams({ ...STABLE_PRESET, ...patch.levers })
    Object.assign(p.eco, patch.eco)
    if (patch.wither) p.witherHours = patch.wither
    if (patch.vision) p.pred.visionUpkeep = patch.vision
    let year = 0
    let foxGone = 0
    let preyGone = 0
    let starved = 0
    let old = 0
    for (let seed = 100; seed < 110; seed++) {
      const s = new Sim(p, seed)
      while (s.step()) {
        /* run */
      }
      if (s.survived) year++
      if (s.preds.length === 0) foxGone++
      if (s.prey.length === 0) preyGone++
      starved += s.counters.predStarved
      old += s.counters.predOld
    }
    const fox = starved + old
    console.log(`${patch.name} year ${year}/10 foxGone ${foxGone} preyGone ${preyGone} starveShare ${fox ? (starved / fox).toFixed(2) : '-'}`)
  }
}
