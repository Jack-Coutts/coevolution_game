/**
 * Vole meadow calibration and one decision comparison (docs/third-species.md sections 8 and 15).
 *
 * Untouched: the Vole meadow from the default settings, game rules (a run ends at the first
 * extinction), one run per seed.
 *
 *   node --import tsx scripts/vole-play.ts untouched 9300 20 out.json
 *
 * Decision 1 (situation 1): at the first hour the field notes' overhunt warning fires (at least
 * ten foxes, under five rabbits per fox, rabbits down 15% in ten days), branch the same world
 * three ways: cull foxes, release rabbits, or do nothing. Run in both meadows on the same seeds.
 *
 *   node --import tsx scripts/vole-play.ts decision 9300 20 out.json
 */
import { writeFileSync } from 'node:fs'
import { STABLE_PRESET } from '../src/game/presets'
import { deriveParams } from '../src/sim/levers'
import { SCENARIO_BY_ID, type ScenarioId } from '../src/sim/scenarios'
import { Sim, type Intervention } from '../src/sim/sim'

const mode = process.argv[2] ?? 'untouched'
const start = Number(process.argv[3] ?? 9300)
const count = Number(process.argv[4] ?? 20)
const out = process.argv[5] ?? '/tmp/vole-play.json'

function meadow(id: ScenarioId, seed: number): Sim {
  const scenario = SCENARIO_BY_ID[id]
  return new Sim(deriveParams(STABLE_PRESET, scenario.species), seed, scenario.disturbance)
}

function counts(s: Sim) {
  return Object.fromEntries(s.species.map(sp => [sp, s.pops[sp].length]))
}

function finish(s: Sim, peaks?: Record<string, number>) {
  while (!s.ended) {
    s.step()
    if (peaks) for (const sp of s.species) peaks[sp] = Math.max(peaks[sp] ?? 0, s.pops[sp].length)
  }
  return {
    survived: s.survived, tick: s.tick, end: counts(s),
    firstExtinct: s.species.filter(sp => s.pops[sp].length === 0),
    ceilingHits: s.ceilingHits,
  }
}

function untouched(seed: number) {
  const s = meadow('voles', seed)
  const peaks: Record<string, number> = {}
  const r = finish(s, peaks)
  const deaths = Object.fromEntries(s.species.map(sp => [sp, s.tally[sp]]))
  return { seed, ...r, peaks, deaths }
}

const overhunt = (s: Sim, rabbits10: number) =>
  s.preds.length >= 10 && s.prey.length < 5 * s.preds.length && rabbits10 > 0 && s.prey.length / rabbits10 - 1 < -0.15

/** Run to the first overhunt warning after day 10; null if the run ends first. */
function toTrigger(id: ScenarioId, seed: number): Sim | null {
  const s = meadow(id, seed)
  const prey: number[] = []
  while (!s.ended) {
    prey[s.tick] = s.prey.length
    if (s.tick >= 240 && overhunt(s, prey[s.tick - 240])) return s
    s.step()
  }
  return null
}

/** Continue one branch: queue the action (if any), then watch 30 days and run to the end. */
function branch(state: ReturnType<Sim['save']>, action: Intervention | null) {
  const s = Sim.restore(structuredClone(state))
  const t0 = s.tick
  if (action) s.queue(action)
  let volePeak = s.voles.length
  let stockMin = 1
  let preyStarved = s.tally.prey.starved
  let preyEaten = s.tally.prey.eaten
  while (!s.ended && s.tick < t0 + 720) {
    s.step()
    volePeak = Math.max(volePeak, s.voles.length)
    stockMin = Math.min(stockMin, s.bushes.reduce((t, b) => t + b.stock, 0) / (s.p.patchStock * Math.max(1, s.bushes.length)))
  }
  preyStarved = s.tally.prey.starved - preyStarved
  preyEaten = s.tally.prey.eaten - preyEaten
  const day30 = counts(s)
  const r = finish(s)
  return { action: action ?? 'wait', volePeak30: volePeak, stockMin30: +stockMin.toFixed(3), preyStarved30: preyStarved, preyEaten30: preyEaten, day30, ...r }
}

function decision(seed: number) {
  const rows = []
  for (const id of ['stable', 'voles'] as const) {
    const s = toTrigger(id, seed)
    if (!s) { rows.push({ scenario: id, seed, trigger: null }); continue }
    const state = s.save()
    const at = { tick: s.tick, ...counts(s) }
    const branches = (['cullPred', 'releasePrey', null] as const).map(a => branch(state, a))
    rows.push({ scenario: id, seed, trigger: at, branches })
  }
  return rows
}

const rows: unknown[] = []
for (let seed = start; seed < start + count; seed++) {
  if (mode === 'untouched') {
    const r = untouched(seed)
    rows.push(r)
    console.log(seed, r.survived ? 'Y' : '.', r.tick, JSON.stringify(r.end), `lost ${r.firstExtinct.join('+') || '-'}`,
      `peaks ${JSON.stringify(r.peaks)}`, `ceiling ${r.ceilingHits}`)
  } else {
    for (const r of decision(seed)) {
      rows.push(r)
      if (!r.trigger) { console.log(r.scenario.padEnd(6), seed, 'no warning'); continue }
      console.log(r.scenario.padEnd(6), seed, `at ${JSON.stringify(r.trigger)}`,
        r.branches!.map(b => `${b.action}:${b.survived ? 'Y' : '.'}${b.tick} volePeak30=${b.volePeak30} stockMin30=${b.stockMin30} starved30=${b.preyStarved30} eaten30=${b.preyEaten30} d30=${JSON.stringify(b.day30)}`).join(' | '))
    }
  }
  writeFileSync(out, JSON.stringify(rows, null, 1))
}
