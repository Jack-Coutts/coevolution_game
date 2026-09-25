/**
 * Common-garden assay: does evolution make rabbits and foxes better at living?
 *
 * 1. Run each seed in three conditions for up to a year, evolving and founder-pool control (newborns sample the original fixed genomes
 *    independently of parental reproductive success), plus selection-only (mutation off), and snapshot genomes at months 0, 1, 4 and 8.
 * 2. Drop each snapshot into fixed arenas against fixed opponents (pooled founders from independent seeds 900–903), with births and ageing off, and measure behaviour.
 *
 *   npx tsx scripts/evo-assay.ts [variant] [seeds] [--json out.json]
 *
 * Variants tweak the eco settings (see VARIANTS); tuning seeds are 100+, reference 900+.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { STABLE_PRESET } from '../src/game/presets'
import type { Genome } from '../src/sim/brain'
import { deriveParams } from '../src/sim/levers'
import type { EcoParams, SimParams } from '../src/sim/params'
import { Sim, type Species } from '../src/sim/sim'

const MONTHS = [0, 1, 4, 8]
const ARENAS = [4242, 4243, 4244]
const ARENA_TICKS = 240
const ARENA = { prey: 60, pred: 10 }

export const VARIANTS: Record<string, Partial<EcoParams>> = {
  linear: { hidden: 0, memory: false, growRate: 0 },
  brain: { hidden: 4, memory: true, growRate: 0 },
  growing: { hidden: 4, memory: true, growRate: 0.02 },
  sexual: { sexual: true },
  cover: { cover: 8 },
}

export function params(variant: string, eco: Partial<EcoParams> = {}): SimParams {
  const p = deriveParams(STABLE_PRESET)
  Object.assign(p.eco, VARIANTS[variant] ?? {}, eco)
  return p
}

type Snap = Partial<Record<Species, Genome[]>>

export function evolve(p: SimParams, seed: number): { snaps: Map<number, Snap>; ticks: number; safetyLimitHits: number } {
  const sim = new Sim(p, seed)
  const snaps = new Map<number, Snap>([[0, { prey: sim.prey.map(a => a.brain), pred: sim.preds.map(a => a.brain) }]])
  const at = new Set(MONTHS.map((m) => m * 720))
  while (sim.step()) {
    if (at.has(sim.tick)) snaps.set(sim.tick / 720, { prey: sim.prey.map((a) => a.brain), pred: sim.preds.map((a) => a.brain) })
  }
  return { snaps, ticks: sim.tick, safetyLimitHits: sim.ceilingHits }
}

export interface Assay {
  escape: number
  forage: number
  preySurvival: number
  catchRate: number
}

function arena(p: SimParams, genomes: Snap, world: number): Sim {
  return new Sim(p, world, undefined, { genomes, counts: ARENA, noBirths: true, noAging: true })
}

/** Rabbits' escape and foraging against reference foxes; foxes' catch rate against reference rabbits. */
export function assay(p: SimParams, subject: Snap, reference: Snap): Assay {
  let escapes = 0
  let caught = 0
  let intake = 0
  let preyHours = 0
  let alive = 0
  let kills = 0
  let foxHours = 0
  for (const w of ARENAS) {
    if (subject.prey?.length && reference.pred?.length) {
      const s = arena(p, { prey: subject.prey, pred: reference.pred }, w)
      for (let t = 0; t < ARENA_TICKS && s.step(); t++) {
        /* run the arena */
      }
      escapes += s.evo.escapes
      caught += s.evo.caught
      intake += s.evo.preyIntake
      preyHours += s.evo.preyHours
      alive += s.prey.length
    }
    if (subject.pred?.length && reference.prey?.length) {
      const s = arena(p, { prey: reference.prey, pred: subject.pred }, w)
      for (let t = 0; t < ARENA_TICKS && s.step(); t++) {
        /* run the arena */
      }
      kills += s.counters.preyEaten
      foxHours += s.evo.predHours
    }
  }
  return {
    escape: escapes + caught ? escapes / (escapes + caught) : NaN,
    forage: preyHours ? intake / preyHours : NaN,
    preySurvival: alive / (ARENA.prey * ARENAS.length),
    catchRate: foxHours ? (kills / foxHours) * 24 : NaN,
  }
}

export function pool(snaps: Snap[], s: Species, n: number): Genome[] {
  const all = snaps.flatMap((x) => x[s] ?? [])
  const out: Genome[] = []
  for (let i = 0; i < n && all.length; i++) out.push(all[Math.floor((i * all.length) / n)])
  return out
}

export function reference(p: SimParams): Snap {
  // Fixed opponents from independent founder seeds, identical for all conditions.
  const refs = [900, 901, 902, 903].map(seed => {
    const s = new Sim(p, seed)
    return { prey: s.prey.map(a => a.brain), pred: s.preds.map(a => a.brain) }
  })
  return { prey: pool(refs, 'prey', ARENA.prey), pred: pool(refs, 'pred', ARENA.pred) }
}

function mean(xs: number[]): number {
  const v = xs.filter((x) => Number.isFinite(x))
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN
}

function main(): void {
  const variant = process.argv[2] ?? 'linear'
  const nSeeds = Number(process.argv[3] ?? 6)
  const jsonAt = process.argv.indexOf('--json')
  const p = params(variant)
  const frozen = params(variant, { heredity: false })
  const ref = reference(params('linear'))
  const rows: { seed: number; condition: string; month: number; ticks: number; assay: Assay | null }[] = []
  const startSeed = Number(process.argv[process.argv.indexOf('--start') + 1]) || 2000
  const outcomes = []
  for (let seed = startSeed; seed < startSeed + nSeeds; seed++) {
    const conditions = [ ['evolving', p], ['founder-pool', frozen],
      ['selection-only', { ...p, mutationRate: 0, eco: { ...p.eco, growRate: 0 } }] ] as const
    for (const [condition, config] of conditions) {
      const ev = evolve(config, seed)
      outcomes.push({ seed, condition, ticks: ev.ticks, safetyLimitHits: ev.safetyLimitHits, survived: ev.ticks >= p.horizon })
      for (const month of MONTHS) {
        const snapshot = ev.snaps.get(month)
        rows.push({ seed, condition, month, ticks: ev.ticks, assay: snapshot ? assay(p, snapshot, ref) : null })
      }
    }
    console.log(`assayed seed ${seed}`)
  }
  const table = ['evolving', 'founder-pool', 'selection-only'].flatMap(condition => MONTHS.map(month => {
    const entries = rows.filter(r => r.condition === condition && r.month === month)
    const values = entries.flatMap(r => r.assay ? [r.assay] : [])
    return { condition, month, available: values.length, total: nSeeds,
      escape: mean(values.map(a => a.escape)), forage: mean(values.map(a => a.forage)),
      preySurvival: mean(values.map(a => a.preySurvival)), catchPerFoxDay: mean(values.map(a => a.catchRate)) }
  }))
  const result = { variant, startSeed, nSeeds, parameters: p, note: 'Behavioural assays condition on surviving populations; missing snapshots are reported, not treated as zero. Survival outcomes include every seed. Founder-pool is a no-inherited-selection control, not mutation-off.', outcomes, table, rows }
  console.table(table)
  if (jsonAt > 0) writeFileSync(process.argv[jsonAt + 1], JSON.stringify(result, null, 2))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
