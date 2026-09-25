/**
 * Inherited body size (issue #10): controlled comparisons and population validation.
 *
 *   node --import tsx scripts/body-assay.ts assay [--json out.json]
 *     Common garden. Identical controllers (a pooled set evolved for three months with body
 *     evolution off, seeds 900–903) are given one size gene each: small (−1, ×0.80), neutral
 *     (0) or large (+1, ×1.25). Each line is dropped into the same arenas against the same
 *     neutral-size opponents, with births and ageing off, and measured:
 *       - predation arena (240 h): rabbits' survival, deaths, intake, distance; foxes' catches;
 *       - famine arena: no food and no hunting (eatR 0); hours from full to starvation, with
 *         the other species fed every hour so the arena does not end.
 *   node --import tsx scripts/body-assay.ts population off|on [start] [count] [--voles] [--json out.json]
 *     Untouched Open meadows on fresh seeds (default 9400–9419), with body evolution off or on:
 *     survival, deaths, peaks, ceiling hits, and mean body size by month.
 */
import { writeFileSync } from 'node:fs'
import { STABLE_PRESET } from '../src/game/presets'
import { defaultBody } from '../src/sim/body'
import type { Genome } from '../src/sim/brain'
import { deriveParams } from '../src/sim/levers'
import type { SimParams } from '../src/sim/params'
import { Sim, type Creature, type Species } from '../src/sim/sim'
import { THREE_SPECIES } from '../src/sim/species'

const WORLDS = Array.from({ length: 16 }, (_, i) => 4242 + i)
const ARENA_TICKS = 240
const ARENA = { prey: 60, pred: 10 }
const LINES = { small: -1, neutral: 0, large: 1 } as const
type Line = keyof typeof LINES

function params(body: boolean, voles = false): SimParams {
  const p = deriveParams(STABLE_PRESET, voles ? THREE_SPECIES : undefined)
  if (body) p.eco.body = defaultBody()
  else delete p.eco.body
  return p
}

/** Controllers evolved for 90 days with body evolution off, pooled over four seeds. */
function controllers(): Record<'prey' | 'pred', Genome[]> {
  const p = params(false)
  const pool: Record<'prey' | 'pred', Genome[]> = { prey: [], pred: [] }
  for (const seed of [900, 901, 902, 903]) {
    const s = new Sim(p, seed)
    let last = { prey: s.prey.map(a => a.brain), pred: s.preds.map(a => a.brain) }
    while (s.tick < 2160 && s.step()) if (s.prey.length && s.preds.length) last = { prey: s.prey.map(a => a.brain), pred: s.preds.map(a => a.brain) }
    pool.prey.push(...last.prey)
    pool.pred.push(...last.pred)
  }
  const pick = (all: Genome[], n: number) => Array.from({ length: n }, (_, i) => all[Math.floor((i * all.length) / n)])
  return { prey: pick(pool.prey, ARENA.prey), pred: pick(pool.pred, ARENA.pred) }
}

const withGene = (gs: Genome[], g: number) => gs.map(x => ({ ...x, sizeGene: g }))
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d

function predation(line: Line, subject: Species, ctl: Record<'prey' | 'pred', Genome[]>) {
  const p = params(true)
  const out = { alive: 0, eaten: 0, starved: 0, intakePerHour: [] as number[], distPerHour: [] as number[], energyEnd: [] as number[],
    kills: 0, foxHours: 0, foxStarved: 0, foxEnergyEnd: [] as number[], escapes: 0, caught: 0 }
  for (const w of WORLDS) {
    const genomes = {
      prey: withGene(ctl.prey, subject === 'prey' ? LINES[line] : 0),
      pred: withGene(ctl.pred, subject === 'pred' ? LINES[line] : 0),
    }
    const s = new Sim(p, w, undefined, { genomes, counts: ARENA, noBirths: true, noAging: true })
    const prev = new Map<Creature, [number, number]>()
    let dist = 0
    let hours = 0
    for (let t = 0; t < ARENA_TICKS; t++) {
      for (const a of s.prey) prev.set(a, [a.x, a.y])
      if (!s.step()) break
      for (const a of s.prey) {
        const [x, y] = prev.get(a)!
        dist += Math.hypot(a.x - x, a.y - y)
        hours++
      }
    }
    out.alive += s.prey.length
    out.eaten += s.tally.prey.eaten
    out.starved += s.tally.prey.starved
    out.intakePerHour.push(s.evo.preyHours ? s.evo.preyIntake / s.evo.preyHours : NaN)
    out.distPerHour.push(hours ? dist / hours : NaN)
    out.energyEnd.push(mean(s.prey.map(a => a.energy / a.maxEnergy)))
    out.kills += s.tally.prey.eaten
    out.foxHours += s.evo.predHours
    out.foxStarved += s.tally.pred.starved
    out.foxEnergyEnd.push(mean(s.preds.map(a => a.energy / a.maxEnergy)))
    out.escapes += s.evo.escapes
    out.caught += s.evo.caught
  }
  const n = ARENA.prey * WORLDS.length
  return {
    rabbitSurvival: round(out.alive / n), rabbitEatenShare: round(out.eaten / n), rabbitStarvedShare: round(out.starved / n),
    rabbitEscapeShare: round(out.escapes / Math.max(1, out.escapes + out.caught)),
    rabbitIntakePerHour: round(mean(out.intakePerHour)), rabbitDistancePerHour: round(mean(out.distPerHour), 6),
    rabbitEnergyEnd: round(mean(out.energyEnd)),
    foxCatchesPerFoxDay: round((out.kills / out.foxHours) * 24), foxStarvedShare: round(out.foxStarved / (ARENA.pred * WORLDS.length)),
    foxEnergyEnd: round(mean(out.foxEnergyEnd)),
  }
}

/** Hours from full energy to starvation with no food and no hunting; the other species is fed. */
function famine(line: Line, subject: 'prey' | 'pred', ctl: Record<'prey' | 'pred', Genome[]>) {
  const p = params(true)
  p.patches = 0
  p.sproutPerDay = 0
  p.eatR = 0
  const hoursToStarve: number[] = []
  const fullEnergy: number[] = []
  for (const w of WORLDS) {
    const genomes = {
      prey: withGene(ctl.prey, subject === 'prey' ? LINES[line] : 0),
      pred: withGene(ctl.pred, subject === 'pred' ? LINES[line] : 0),
    }
    const s = new Sim(p, w, undefined, { genomes, counts: ARENA, noBirths: true, noAging: true })
    const other: Species = subject === 'prey' ? 'pred' : 'prey'
    for (const a of s.pops[subject]) { a.energy = a.maxEnergy; fullEnergy.push(a.maxEnergy) }
    const alive = new Set(s.pops[subject])
    for (let t = 1; t <= 3000 && alive.size; t++) {
      for (const a of s.pops[other]) a.energy = a.maxEnergy
      s.step()
      const now = new Set(s.pops[subject])
      for (const a of alive) if (!now.has(a)) { hoursToStarve.push(t); alive.delete(a) }
      if (s.ended) break
    }
  }
  const hours = mean(hoursToStarve)
  return { reserve: round(mean(fullEnergy), 2), hoursToStarve: round(hours, 1), burnPerHour: round(mean(fullEnergy) / hours, 3), starvedCount: hoursToStarve.length }
}

/**
 * Breeding arena: births and ageing on, mutation off (so every young keeps its line's size), 30 days.
 * The subject line is one species; the other is neutral. Reports births per animal-day and the line's size at the end.
 */
function breeding(line: Line, subject: 'prey' | 'pred', ctl: Record<'prey' | 'pred', Genome[]>) {
  const p = params(true)
  p.mutationRate = 0
  let births = 0
  let hours = 0
  let end = 0
  let eaten = 0
  let starved = 0
  for (const w of WORLDS) {
    const genomes = {
      prey: withGene(ctl.prey, subject === 'prey' ? LINES[line] : 0),
      pred: withGene(ctl.pred, subject === 'pred' ? LINES[line] : 0),
    }
    const s = new Sim(p, w, undefined, { genomes, counts: ARENA })
    for (let t = 0; t < 720; t++) {
      hours += s.pops[subject].length
      if (!s.step()) break
    }
    births += s.tally[subject].born
    end += s.pops[subject].length
    eaten += s.tally[subject].eaten
    starved += s.tally[subject].starved
  }
  const start = ARENA[subject] * WORLDS.length
  return { birthsPerAnimalDay: round((births / hours) * 24), endPerFounder: round(end / start, 3), eatenPerFounder: round(eaten / start, 3), starvedPerFounder: round(starved / start, 3) }
}

function assayMain(json?: string) {
  const ctl = controllers()
  const lines = Object.keys(LINES) as Line[]
  const table = lines.map(line => ({
    line, size: round(1.25 ** LINES[line], 3),
    rabbits: predation(line, 'prey', ctl),
    foxes: predation(line, 'pred', ctl),
    rabbitFamine: famine(line, 'prey', ctl),
    foxFamine: famine(line, 'pred', ctl),
    rabbitBreeding: breeding(line, 'prey', ctl),
    foxBreeding: breeding(line, 'pred', ctl),
  }))
  for (const r of table) {
    console.log(r.line, 'x' + r.size)
    console.log('  rabbits (large/small rabbits vs neutral foxes):', JSON.stringify(r.rabbits))
    console.log('  foxes (large/small foxes vs neutral rabbits):', JSON.stringify(r.foxes))
    console.log('  rabbit famine:', JSON.stringify(r.rabbitFamine), ' fox famine:', JSON.stringify(r.foxFamine))
    console.log('  30-day breeding: rabbits', JSON.stringify(r.rabbitBreeding), ' foxes', JSON.stringify(r.foxBreeding))
  }
  const p = params(true)
  const young = lines.map(line => ({ line, rabbitBreedAt: round(p.prey.breedEnergy * p.prey.maxEnergy * 1.25 ** LINES[line], 1),
    rabbitYoungCost: round(p.prey.childEnergy * p.prey.maxEnergy * 1.25 ** LINES[line], 1),
    foxBreedAt: round(p.pred.breedEnergy * p.pred.maxEnergy * 1.25 ** LINES[line], 1), foxYoungCost: round(p.pred.childEnergy * p.pred.maxEnergy * 1.25 ** LINES[line], 1) }))
  console.log('breeding energy:', JSON.stringify(young))
  if (json) writeFileSync(json, JSON.stringify({ worlds: WORLDS, arenaTicks: ARENA_TICKS, arena: ARENA, controllers: 'body-off STABLE_PRESET, seeds 900–903, living genomes at day 90, pooled', table, breeding: young }, null, 2))
}

function populationMain(mode: 'off' | 'on', start: number, count: number, voles: boolean, json?: string) {
  const p = params(mode === 'on', voles)
  const rows: { seed: number; survived: boolean; tick: number; prey: number; foxes: number; maxPrey: number; maxFox: number
    safetyLimitHits: number; deaths: Sim['counters']; sizeByQuarter: { month: number; rabbit: number; fox: number; vole: number }[]
    endSize: { rabbit: number; fox: number; vole: number }; voles: number }[] = []
  for (let seed = start; seed < start + count; seed++) {
    const s = new Sim(p, seed)
    let maxPrey = s.prey.length
    let maxFox = s.preds.length
    const sizes = () => ({ rabbit: round(mean(s.prey.map(a => a.size))), fox: round(mean(s.preds.map(a => a.size))), vole: round(mean(s.voles.map(a => a.size))) })
    const bySize: { month: number; rabbit: number; fox: number; vole: number }[] = []
    const sample = () => bySize.push({ month: s.tick / 720, ...sizes() })
    sample()
    while (s.step()) {
      maxPrey = Math.max(maxPrey, s.prey.length)
      maxFox = Math.max(maxFox, s.preds.length)
      if (s.tick % 2160 === 0) sample()
    }
    rows.push({ seed, survived: s.survived, tick: s.tick, prey: s.prey.length, foxes: s.preds.length, maxPrey, maxFox,
      safetyLimitHits: s.ceilingHits, deaths: s.counters, sizeByQuarter: bySize,
      endSize: sizes(), voles: s.voles.length })
    console.log(seed, s.survived, s.tick, s.prey.length, s.preds.length, JSON.stringify(rows.at(-1)!.endSize))
  }
  const survived = rows.filter(r => r.survived).length
  const deaths = (k: keyof (typeof rows)[number]['deaths']) => rows.reduce((t, r) => t + r.deaths[k], 0)
  const summary = { mode, meadow: voles ? 'voles' : 'open', start, count, survived, survivalRate: survived / count, ceilingHitRuns: rows.filter(r => r.safetyLimitHits > 0).length,
    medianTick: [...rows.map(r => r.tick)].sort((a, b) => a - b)[Math.floor(count / 2)],
    extinctFirst: { rabbits: rows.filter(r => !r.survived && r.prey === 0).length, foxes: rows.filter(r => !r.survived && r.foxes === 0).length, voles: voles ? rows.filter(r => !r.survived && r.voles === 0).length : 0 },
    deaths: { preyEaten: deaths('preyEaten'), preyStarved: deaths('preyStarved'), preyOld: deaths('preyOld'), predStarved: deaths('predStarved'), predOld: deaths('predOld') } }
  console.log(JSON.stringify(summary))
  if (json) writeFileSync(json, JSON.stringify({ summary, parameters: p, rows }, null, 2))
}

const [mode, ...rest] = process.argv.slice(2)
const jsonAt = process.argv.indexOf('--json')
const json = jsonAt > 0 ? process.argv[jsonAt + 1] : undefined
if (mode === 'assay') assayMain(json)
else if (mode === 'population') populationMain(rest[0] === 'on' ? 'on' : 'off', Number(rest[1] ?? 9400), Number(rest[2] ?? 20), process.argv.includes('--voles'), json)
else console.log('usage: body-assay.ts assay | population off|on [start] [count] [--json out.json]')
