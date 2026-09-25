/**
 * Untouched Vole meadow runs against the Open meadow on the same seeds, one process, one run
 * at a time. Measures simulation time per simulated year (sim.step only, and the worker's
 * frame, statistics and evolution packing separately), frame and history sizes, safety-ceiling
 * hits, peaks and first extinctions. The run follows game rules: it ends at the first extinction.
 *
 *   node --import tsx scripts/vole-batch.ts 9100 10 out.json
 */
import { writeFileSync } from 'node:fs'
import { RunHistory } from '../src/game/history'
import { STABLE_PRESET } from '../src/game/presets'
import { summarizeEvolution } from '../src/sim/evolution'
import { deriveParams } from '../src/sim/levers'
import { SCENARIO_BY_ID, type ScenarioId } from '../src/sim/scenarios'
import { Sim } from '../src/sim/sim'
import type { Species } from '../src/sim/species'
import { frame, writeStats } from '../src/worker/pack'
import { STAT_STRIDE, type FrameData } from '../src/worker/protocol'

const start = Number(process.argv[2] ?? 9100)
const count = Number(process.argv[3] ?? 10)
const out = process.argv[4] ?? '/tmp/vole-batch.json'

function frameBytes(f: FrameData): number {
  return f.prey.byteLength + f.preds.byteLength + (f.voles?.byteLength ?? 0) + f.bushes.byteLength + f.events.byteLength
}

function run(id: ScenarioId, seed: number) {
  const scenario = SCENARIO_BY_ID[id]
  const p = deriveParams(STABLE_PRESET, scenario.species)
  const s = new Sim(p, seed, scenario.disturbance, { record: true })
  const history = new RunHistory(p.horizon, false, scenario.species)
  history.add(frame(s), statsRow(s), 0)
  const peak = Object.fromEntries(s.species.map(sp => [sp, s.pops[sp].length])) as Partial<Record<Species, number>>
  let stepMs = 0
  let packMs = 0
  let bytes = 0
  let maxBytes = 0
  while (!s.ended) {
    const t0 = performance.now()
    s.step()
    const t1 = performance.now()
    if (s.tick % 24 === 0 || s.ended) history.addEvolution(summarizeEvolution(s))
    const f = frame(s)
    history.add(f, statsRow(s), 0)
    packMs += performance.now() - t1
    stepMs += t1 - t0
    const b = frameBytes(f)
    bytes += b
    maxBytes = Math.max(maxBytes, b)
    for (const sp of s.species) peak[sp] = Math.max(peak[sp]!, s.pops[sp].length)
  }
  const saved = history.save()
  const savedBytes = saved.stats.byteLength + saved.frames.reduce((t, [, f]) => t + frameBytes(f), 0)
  const firstExtinct = s.species.filter(sp => s.pops[sp].length === 0)
  return {
    scenario: id, seed, survived: s.survived, tick: s.tick, firstExtinct,
    end: Object.fromEntries(s.species.map(sp => [sp, s.pops[sp].length])), peak,
    safetyLimitHits: s.ceilingHits, tally: Object.fromEntries(s.species.map(sp => [sp, s.tally[sp]])),
    stepMsPerYear: stepMs / s.tick * 8760, packMsPerYear: packMs / s.tick * 8760,
    meanFrameBytes: bytes / s.tick, maxFrameBytes: maxBytes,
    statsRowValues: STAT_STRIDE, historyStatsBytes: history.stats.byteLength, savedHistoryBytes: savedBytes,
    grassSeedLeft: s.grassSeed.length ? s.grassSeed.reduce((a, b) => a + b, 0) / s.grassSeed.length : null,
  }
}

function statsRow(s: Sim): Float64Array {
  const row = new Float64Array(STAT_STRIDE)
  writeStats(s, row, 0)
  return row
}

const rows = []
for (let seed = start; seed < start + count; seed++) {
  for (const id of ['stable', 'voles'] as const) {
    const r = run(id, seed)
    rows.push(r)
    console.log(id.padEnd(6), seed, r.survived ? 'Y' : '.', r.tick, JSON.stringify(r.end), `lost ${r.firstExtinct.join('+') || '-'}`,
      `step ${Math.round(r.stepMsPerYear)} ms/yr`, `pack ${Math.round(r.packMsPerYear)} ms/yr`, `ceiling ${r.safetyLimitHits}`)
  }
}
writeFileSync(out, JSON.stringify({ start, count, node: process.version, platform: `${process.platform} ${process.arch}`, rows }, null, 1))
