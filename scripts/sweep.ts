/**
 * Offline lever sweep.
 *
 *   npx tsx scripts/sweep.ts random <shard> <count> <out.jsonl>
 *   npx tsx scripts/sweep.ts climb <in.json> <iterations> <out.jsonl> <shard>
 *   npx tsx scripts/sweep.ts fix <preset.json> <scenario> <iterations> <out.jsonl>
 *   npx tsx scripts/sweep.ts eval <in.json> <firstSeed> <nSeeds>
 *
 * Tuning uses held-out seeds (100+); seeds 0-9 are only used for the final report.
 */
import { appendFileSync, readFileSync } from 'node:fs'
import { defaultLevers, BUDGET, clampLever, deriveParams, LEVER_BY_ID, spent, type LeverValues } from '../src/sim/levers'
import { Rng } from '../src/sim/rng'
import { SCENARIO_BY_ID, type ScenarioId } from '../src/sim/scenarios'
import { NO_DISTURBANCE, runHeadless, type Disturbance } from '../src/sim/sim'

const RANGES: Record<string, [number, number]> = {
  'prey.initial': [30, 100],
  'pred.initial': [4, 16],
  'food.patches': [8, 20],
  'food.stock': [20, 50],
  'food.regrow': [4, 15],
  'prey.maxEnergy': [80, 200],
  'prey.metabolism': [0.15, 0.45],
  'prey.speedCost': [0.4, 1.0],
  'prey.mealEnergy': [20, 60],
  'prey.breedEnergy': [0.5, 0.8],
  'prey.childEnergy': [0.25, 0.5],
  'prey.adultAge': [60, 120],
  'prey.birthGap': [100, 200],
  'prey.lifespan': [500, 900],
  'pred.maxEnergy': [120, 320],
  'pred.metabolism': [0.15, 0.45],
  'pred.speedCost': [0.4, 1.0],
  'pred.mealEnergy': [60, 160],
  'pred.breedEnergy': [0.5, 0.85],
  'pred.childEnergy': [0.25, 0.5],
  'pred.adultAge': [80, 160],
  'pred.birthGap': [150, 300],
  'pred.lifespan': [600, 1000],
  'prey.speed': [0.9, 1.2],
  'pred.speed': [0.8, 1.1],
  'pred.sense': [0.8, 1.5],
  'evo.mutation': [0.06, 0.2],
}

export interface Score {
  survived: number
  median: number
  runs: number[]
}

export function evaluate(v: LeverValues, seeds: number[], abortBelow = 0, dist: Disturbance = NO_DISTURBANCE): Score {
  const p = deriveParams(v)
  const runs: number[] = []
  let survived = 0
  for (let i = 0; i < seeds.length; i++) {
    const r = runHeadless(p, seeds[i], dist)
    runs.push(r.survival_ticks)
    if (r.survived) survived++
    if (survived + (seeds.length - i - 1) < abortBelow) break
  }
  const s = [...runs].sort((a, b) => a - b)
  return { survived, median: s[Math.floor(s.length / 2)], runs }
}

function sample(rng: Rng): LeverValues {
  const v = defaultLevers()
  for (const [id, [lo, hi]] of Object.entries(RANGES)) v[id] = clampLever(LEVER_BY_ID[id], rng.uniform(lo, hi))
  return v
}

function perturb(rng: Rng, base: LeverValues, k: number): LeverValues {
  const v = { ...base }
  const ids = Object.keys(RANGES)
  for (let i = 0; i < k; i++) {
    const id = ids[Math.floor(rng.random() * ids.length)]
    const def = LEVER_BY_ID[id]
    const dir = rng.random() < 0.5 ? -1 : 1
    const n = 1 + Math.floor(rng.random() * 3)
    v[id] = clampLever(def, v[id] + dir * n * def.step)
  }
  return v
}

const range = (a: number, n: number) => Array.from({ length: n }, (_, i) => a + i)

function main(): void {
  const [mode, ...args] = process.argv.slice(2)
  if (mode === 'random') {
    const [shard, count, out] = [Number(args[0]), Number(args[1]), args[2]]
    const rng = new Rng(1000 + shard)
    const seeds = range(100, 10)
    for (let i = 0; i < count; i++) {
      const v = sample(rng)
      const s = evaluate(v, seeds, 4)
      appendFileSync(out, JSON.stringify({ ...s, v }) + '\n')
    }
  } else if (mode === 'climb') {
    const [inFile, iters, out, shard] = [args[0], Number(args[1]), args[2], Number(args[3])]
    const rng = new Rng(5000 + shard)
    const seeds = range(100, 20)
    let best = JSON.parse(readFileSync(inFile, 'utf8')) as LeverValues
    let bestS = evaluate(best, seeds)
    appendFileSync(out, JSON.stringify({ ...bestS, v: best, iter: 0 }) + '\n')
    for (let i = 1; i <= iters; i++) {
      const v = perturb(rng, best, 1 + Math.floor(rng.random() * 3))
      const s = evaluate(v, seeds, bestS.survived)
      if (s.survived > bestS.survived || (s.survived === bestS.survived && s.median > bestS.median)) {
        best = v
        bestS = s
        appendFileSync(out, JSON.stringify({ ...bestS, v: best, iter: i }) + '\n')
      }
    }
  } else if (mode === 'fix') {
    // Can a scenario be rescued from the preset within the point budget?
    const [inFile, scenarioId, iters, out] = [args[0], args[1] as ScenarioId, Number(args[2]), args[3]]
    const rng = new Rng(7000)
    const seeds = range(100, 10)
    const base = JSON.parse(readFileSync(inFile, 'utf8')) as LeverValues
    const dist = SCENARIO_BY_ID[scenarioId].disturbance
    let best = base
    let bestS = evaluate(best, seeds, 0, dist)
    appendFileSync(out, JSON.stringify({ ...bestS, spent: 0, v: best, iter: 0 }) + '\n')
    for (let i = 1; i <= iters; i++) {
      const v = perturb(rng, best, 1 + Math.floor(rng.random() * 2))
      const cost = spent(v, base)
      if (cost > BUDGET) continue
      const s = evaluate(v, seeds, bestS.survived, dist)
      if (s.survived > bestS.survived || (s.survived === bestS.survived && s.median > bestS.median)) {
        best = v
        bestS = s
        appendFileSync(out, JSON.stringify({ ...bestS, spent: cost, v: best, iter: i }) + '\n')
      }
    }
  } else if (mode === 'eval') {
    const v = JSON.parse(readFileSync(args[0], 'utf8')) as LeverValues
    const s = evaluate(v, range(Number(args[1]), Number(args[2])))
    console.log(JSON.stringify(s))
  }
}

main()
