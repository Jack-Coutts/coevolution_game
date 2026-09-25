/**
 * Brain assay (issue #13): do hidden neurons, memory or structural growth give evolved animals
 * behaviour that the default linear controller does not reach?
 *
 * Behavioural success is defined before running, on fixed common-garden arenas:
 *   - forage: energy eaten per rabbit-hour, net of brain upkeep (hidden neurons cost energy);
 *   - catchPerEncounter: share of fox encounters (a fox within chase range) that end in capture;
 *   - flee: while a fox is within chase range, the rabbit's next move along the away-from-fox
 *     direction, as a fraction of top speed. This is the visible "rabbit bolts from a fox" behaviour;
 *   - catchPerFoxDay: evolved foxes' catches against the fixed reference rabbits.
 * The 24-hour encounter-survival proxy is not used.
 *
 * Each condition evolves on the same seeds (paired) for three months, alongside a founder-pool
 * control of the same architecture (newborns sample the founders, so no inherited selection).
 * Month-0 and month-3 snapshots meet fixed opponents (linear founders from independent seeds
 * 900-903, memory input weights zeroed so they behave identically under every condition) in fresh
 * arena seeds 7100-7102. Wall-clock per simulated hour measures the computational cost.
 *
 *   npx tsx scripts/brain-assay.ts [seeds=10] [--start 6100] [--json docs/experiments/brains.json]
 */
import { writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { offsets, randomGenome, SENSE, N_IN, N_OUT, think, type Genome } from '../src/sim/brain'
import { Rng } from '../src/sim/rng'
import type { EcoParams, SimParams } from '../src/sim/params'
import { Sim, type Species } from '../src/sim/sim'
import { params, pool } from './evo-assay'

const MONTHS = 3
const HORIZON = MONTHS * 720
const ARENAS = [7100, 7101, 7102]
const ARENA_TICKS = 240
const ARENA = { prey: 60, pred: 10 }
const CHASE_R = 0.06

export const CONDITIONS: Record<string, Partial<EcoParams>> = {
  linear: { hidden: 0, memory: false, growRate: 0 },
  hidden: { hidden: 4, memory: false, growRate: 0 },
  memory: { hidden: 0, memory: true, growRate: 0 },
  growth: { hidden: 0, memory: false, growRate: 0.05 },
}

type Snap = Partial<Record<Species, Genome[]>>

interface Result {
  forage: number
  netForage: number
  catchPerEncounter: number
  flee: number
  preySurvival: number
  catchPerFoxDay: number
  preyHidden: number
  predHidden: number
}

function setup(condition: string, heredity: boolean): SimParams {
  const p = params('linear', { ...CONDITIONS[condition], heredity })
  p.horizon = HORIZON
  return p
}

function snap(sim: Sim): Snap {
  return { prey: sim.prey.map((a) => a.brain), pred: sim.preds.map((a) => a.brain) }
}

function evolve(p: SimParams, seed: number) {
  const sim = new Sim(p, seed)
  const start = snap(sim)
  const t0 = performance.now()
  while (sim.step()) {
    /* evolve */
  }
  const ms = performance.now() - t0
  const survived = sim.tick >= HORIZON && sim.prey.length > 0 && sim.preds.length > 0
  const animalHours = sim.evo.preyHours + sim.evo.predHours
  return {
    start,
    end: survived ? snap(sim) : null,
    outcome: {
      ticks: sim.tick,
      survived,
      safetyLimitHits: sim.ceilingHits,
      msPerHour: ms / Math.max(1, sim.tick),
      msPer1000AnimalHours: (ms / Math.max(1, animalHours)) * 1000,
    },
  }
}

/** Linear founders with the memory input disconnected, so opponents are identical whatever `eco.memory` is. */
function reference(): Snap {
  const p = params('linear')
  const refs = [900, 901, 902, 903].map((seed) => snap(new Sim(p, seed)))
  const cut = (g: Genome): Genome => {
    const w = g.w.slice()
    const { skip } = offsets(g.nHid)
    for (let o = 0; o < N_OUT; o++) w[skip + o * N_IN + SENSE.memory] = 0
    for (let j = 0; j < g.nHid; j++) w[j * N_IN + SENSE.memory] = 0
    return { nHid: g.nHid, w }
  }
  return { prey: pool(refs, 'prey', ARENA.prey).map(cut), pred: pool(refs, 'pred', ARENA.pred).map(cut) }
}

function arena(p: SimParams, genomes: Snap, world: number): Sim {
  return new Sim(p, world, undefined, { genomes, counts: ARENA, noBirths: true, noAging: true })
}

const meanOf = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)

function assay(p: SimParams, subject: Snap, ref: Snap): Result {
  let intake = 0
  let preyHours = 0
  let encounters = 0
  let caught = 0
  let alive = 0
  let fleeSum = 0
  let fleeN = 0
  let kills = 0
  let foxHours = 0
  const top = p.prey.step
  for (const w of ARENAS) {
    const s = arena(p, { prey: subject.prey, pred: ref.pred }, w)
    for (let t = 0; t < ARENA_TICKS; t++) {
      const before = new Map<number, [number, number, number, number]>()
      for (const a of s.prey) {
        let best = CHASE_R * CHASE_R
        let fx = NaN
        let fy = NaN
        for (const f of s.preds) {
          const d2 = (f.x - a.x) ** 2 + (f.y - a.y) ** 2
          if (d2 < best) {
            best = d2
            fx = f.x
            fy = f.y
          }
        }
        if (Number.isFinite(fx)) before.set(a.id, [a.x, a.y, fx, fy])
      }
      if (!s.step()) break
      for (const a of s.prey) {
        const b = before.get(a.id)
        if (!b) continue
        const [x, y, fx, fy] = b
        const d = Math.hypot(x - fx, y - fy) || 1
        fleeSum += ((a.x - x) * (x - fx) + (a.y - y) * (y - fy)) / d / top
        fleeN++
      }
    }
    intake += s.evo.preyIntake
    preyHours += s.evo.preyHours
    encounters += s.evo.encounters
    caught += s.evo.caught
    alive += s.prey.length
    const f = arena(p, { prey: ref.prey, pred: subject.pred }, w)
    for (let t = 0; t < ARENA_TICKS && f.step(); t++) {
      /* run the arena */
    }
    kills += f.counters.preyEaten
    foxHours += f.evo.predHours
  }
  const preyHidden = meanOf((subject.prey ?? []).map((g) => g.nHid))
  const forage = preyHours ? intake / preyHours : NaN
  return {
    forage,
    netForage: forage - p.eco.brainUpkeep * preyHidden,
    catchPerEncounter: encounters ? caught / encounters : NaN,
    flee: fleeN ? fleeSum / fleeN : NaN,
    preySurvival: alive / (ARENA.prey * ARENAS.length),
    catchPerFoxDay: foxHours ? (kills / foxHours) * 24 : NaN,
    preyHidden,
    predHidden: meanOf((subject.pred ?? []).map((g) => g.nHid)),
  }
}

const METRICS = ['netForage', 'catchPerEncounter', 'flee', 'catchPerFoxDay', 'preySurvival'] as const
/** Direction of improvement: fewer catches per encounter is better for rabbits. */
const SIGN: Record<(typeof METRICS)[number], number> = { netForage: 1, catchPerEncounter: -1, flee: 1, catchPerFoxDay: 1, preySurvival: 1 }

/** Nanoseconds per forward pass by hidden-layer size, the direct computational price of a bigger brain. */
function thinkNs(): Record<number, number> {
  const rng = new Rng(1)
  const x = new Float64Array(N_IN).map(() => rng.uniform(-1, 1))
  const hid = new Float64Array(64)
  const out = new Float64Array(N_OUT)
  const res: Record<number, number> = {}
  for (const h of [0, 4, 12]) {
    const g = randomGenome(rng, h, 1)
    for (let i = 0; i < 2e5; i++) think(g, x, hid, out)
    const t = performance.now()
    for (let i = 0; i < 1e6; i++) think(g, x, hid, out)
    res[h] = (performance.now() - t)
  }
  return res
}

function main(): void {
  const nSeeds = Number(process.argv[2] ?? 10)
  const at = process.argv.indexOf('--start')
  const startSeed = at > 0 ? Number(process.argv[at + 1]) : 6100
  const jsonAt = process.argv.indexOf('--json')
  const ref = reference()
  const t0 = performance.now()
  const outcomes: Record<string, unknown>[] = []
  const rows: { seed: number; condition: string; control: string; month: number; assay: Result | null }[] = []
  for (let seed = startSeed; seed < startSeed + nSeeds; seed++) {
    for (const condition of Object.keys(CONDITIONS)) {
      for (const [control, heredity] of [['evolving', true], ['founder-pool', false]] as const) {
        const p = setup(condition, heredity)
        const ev = evolve(p, seed)
        outcomes.push({ seed, condition, control, ...ev.outcome })
        if (control === 'evolving') rows.push({ seed, condition, control, month: 0, assay: assay(p, ev.start, ref) })
        rows.push({ seed, condition, control, month: MONTHS, assay: ev.end ? assay(p, ev.end, ref) : null })
      }
    }
    console.log(`seed ${seed} done, ${((performance.now() - t0) / 60000).toFixed(1)} min`)
  }
  const pick = (c: string, ctl: string, m: number) => rows.filter((r) => r.condition === c && r.control === ctl && r.month === m)
  const table = Object.keys(CONDITIONS).flatMap((condition) =>
    [['evolving', 0], ['evolving', MONTHS], ['founder-pool', MONTHS]].map(([control, month]) => {
      const rs = pick(condition, control as string, month as number)
      const got = rs.flatMap((r) => (r.assay ? [r.assay] : []))
      const out: Record<string, unknown> = { condition, control, month, available: got.length, total: rs.length }
      for (const k of [...METRICS, 'forage', 'preyHidden', 'predHidden'] as const) out[k] = meanOf(got.map((a) => a[k]).filter(Number.isFinite))
      return out
    }),
  )
  // Paired comparisons at month 3, on seeds where both sides have a surviving population.
  const paired = (a: string, actl: string, b: string, bctl: string) => {
    const A = pick(a, actl, MONTHS)
    const B = pick(b, bctl, MONTHS)
    const out: Record<string, unknown> = { subject: `${a}/${actl}`, baseline: `${b}/${bctl}` }
    for (const k of METRICS) {
      const d: number[] = []
      for (const r of A) {
        const q = B.find((x) => x.seed === r.seed)
        if (r.assay && q?.assay && Number.isFinite(r.assay[k]) && Number.isFinite(q.assay[k])) d.push(SIGN[k] * (r.assay[k] - q.assay[k]))
      }
      const m = meanOf(d)
      const sd = Math.sqrt(meanOf(d.map((x) => (x - m) ** 2)) * (d.length / Math.max(1, d.length - 1)))
      out[k] = { n: d.length, better: d.filter((x) => x > 0).length, meanGain: m, ci95: (1.96 + 2.4 / Math.max(1, d.length - 1)) * (sd / Math.sqrt(d.length)) }
    }
    return out
  }
  const comparisons = [
    ...['hidden', 'memory', 'growth'].map((c) => paired(c, 'evolving', 'linear', 'evolving')),
    ...Object.keys(CONDITIONS).map((c) => paired(c, 'evolving', c, 'founder-pool')),
  ]
  const cost = Object.keys(CONDITIONS).map((condition) => {
    const os = outcomes.filter((o) => o.condition === condition && o.control === 'evolving')
    return {
      condition,
      survivedMonths3: os.filter((o) => o.survived).length,
      total: os.length,
      safetyLimitHits: os.reduce((s, o) => s + (o.safetyLimitHits as number), 0),
      msPerHour: meanOf(os.map((o) => o.msPerHour as number)),
      msPer1000AnimalHours: meanOf(os.map((o) => o.msPer1000AnimalHours as number)),
    }
  })
  const runtimeMinutes = (performance.now() - t0) / 60000
  console.table(table)
  console.table(cost)
  console.log(JSON.stringify(comparisons, null, 1))
  const result = {
    startSeed,
    nSeeds,
    months: MONTHS,
    arenas: ARENAS,
    arenaTicks: ARENA_TICKS,
    conditions: CONDITIONS,
    parameters: setup('linear', true),
    runtimeMinutes,
    thinkNs: thinkNs(),
    note: 'Month-3 assays condition on populations that survived; missing snapshots are counted (available/total), never zero. meanGain is signed so positive favours the subject; ci95 is an approximate paired t-interval half-width. thinkNs is a micro-benchmark of one brain forward pass.',
    table,
    cost,
    comparisons,
    outcomes,
    rows,
  }
  if (jsonAt > 0) writeFileSync(process.argv[jsonAt + 1], JSON.stringify(result, null, 2))
}

main()
