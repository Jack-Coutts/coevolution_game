/**
 * Common-garden assay: does evolution make rabbits and foxes better at living?
 *
 * 1. Run each seed twice for up to a year, evolving and frozen (no heredity: newborns get
 *    fresh random genes), and snapshot every living genome at months 1, 4 and 8.
 * 2. Drop each snapshot into fixed arenas against fixed opponents (a pooled month-8 sample,
 *    or month 4, from separate reference runs), with births and ageing off, and measure behaviour.
 *
 *   npx tsx scripts/evo-assay.ts [variant] [seeds] [--json out.json]
 *
 * Variants tweak the eco settings (see VARIANTS); tuning seeds are 100+, reference 900+.
 */
import { writeFileSync } from 'node:fs'
import { STABLE_PRESET } from '../src/game/presets'
import type { Genome } from '../src/sim/brain'
import { deriveParams } from '../src/sim/levers'
import type { EcoParams, SimParams } from '../src/sim/params'
import { Sim, type Species } from '../src/sim/sim'

const MONTHS = [1, 4, 8]
const ARENAS = [4242, 4243, 4244]
const ARENA_TICKS = 240
const ARENA = { prey: 60, pred: 10 }

export const VARIANTS: Record<string, Partial<EcoParams>> = {
  linear: { hidden: 0, memory: false, growRate: 0 },
  brain: {},
  sexual: { sexual: true },
  cover: { cover: 8 },
}

export function params(variant: string, eco: Partial<EcoParams> = {}): SimParams {
  const p = deriveParams(STABLE_PRESET)
  Object.assign(p.eco, VARIANTS[variant] ?? {}, eco)
  return p
}

type Snap = Partial<Record<Species, Genome[]>>

export function evolve(p: SimParams, seed: number): { snaps: Map<number, Snap>; ticks: number } {
  const sim = new Sim(p, seed)
  const snaps = new Map<number, Snap>()
  const at = new Set(MONTHS.map((m) => m * 720))
  while (sim.step()) {
    if (at.has(sim.tick)) snaps.set(sim.tick / 720, { prey: sim.prey.map((a) => a.brain), pred: sim.preds.map((a) => a.brain) })
  }
  return { snaps, ticks: sim.tick }
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

function pool(snaps: Snap[], s: Species, n: number): Genome[] {
  const all = snaps.flatMap((x) => x[s] ?? [])
  const out: Genome[] = []
  for (let i = 0; i < n && all.length; i++) out.push(all[Math.floor((i * all.length) / n)])
  return out
}

export function reference(p: SimParams): Snap {
  const late: Snap[] = []
  for (let seed = 900; seed < 940 && late.length < 4; seed++) {
    const { snaps } = evolve(p, seed)
    const s = snaps.get(8) ?? snaps.get(4)
    if (s?.prey?.length && s.pred?.length) late.push(s)
  }
  if (late.length === 0) throw new Error('no reference run lived to month 4')
  return { prey: pool(late, 'prey', ARENA.prey), pred: pool(late, 'pred', ARENA.pred) }
}

function mean(xs: number[]): number {
  const v = xs.filter((x) => Number.isFinite(x))
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN
}

function main(): void {
  const variant = process.argv[2] ?? 'brain'
  const nSeeds = Number(process.argv[3] ?? 6)
  const jsonAt = process.argv.indexOf('--json')
  const p = params(variant)
  const frozen = params(variant, { heredity: false })
  const ref = reference(p)
  const rows: Record<string, Assay[]> = {}
  const push = (k: string, a: Assay) => (rows[k] ??= []).push(a)
  const founders = new Sim(p, 100)
  push('founders', assay(p, { prey: founders.prey.map((a) => a.brain), pred: founders.preds.map((a) => a.brain) }, ref))
  let yearEnd = 0
  for (let seed = 100; seed < 100 + nSeeds; seed++) {
    const ev = evolve(p, seed)
    const fr = evolve(frozen, seed)
    if (ev.ticks >= p.horizon) yearEnd++
    for (const m of MONTHS) {
      const e = ev.snaps.get(m)
      const f = fr.snaps.get(m)
      if (e) push(`evolving m${m}`, assay(p, e, ref))
      if (f) push(`frozen m${m}`, assay(p, f, ref))
    }
  }
  const table = Object.entries(rows).map(([k, v]) => ({
    snapshot: k,
    n: v.length,
    escape: mean(v.map((a) => a.escape)),
    forage: mean(v.map((a) => a.forage)),
    preySurvival: mean(v.map((a) => a.preySurvival)),
    catchPerFoxDay: mean(v.map((a) => a.catchRate)),
  }))
  console.log(`variant ${variant}: ${yearEnd}/${nSeeds} evolving runs reached the year`)
  for (const r of table) {
    console.log(
      `  ${r.snapshot.padEnd(12)} n=${r.n}  escape ${(100 * r.escape).toFixed(1)}%  forage ${r.forage.toFixed(3)}/h  rabbits alive ${(100 * r.preySurvival).toFixed(0)}%  fox catches/day ${r.catchPerFoxDay.toFixed(2)}`,
    )
  }
  if (jsonAt > 0) writeFileSync(process.argv[jsonAt + 1], JSON.stringify({ variant, yearEnd, nSeeds, table }, null, 2))
}

main()
