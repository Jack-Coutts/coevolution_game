/**
 * One long Endless run with daily variety tracking: cost, save/resume, and where persistent varieties appear.
 *
 *   npx tsx scripts/varieties-run.ts <scenario> <seed> <years> [out.json]
 */
import { writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { RunHistory } from '../src/game/history'
import { STABLE_PRESET } from '../src/game/presets'
import { summarizeEvolution } from '../src/sim/evolution'
import { deriveParams } from '../src/sim/levers'
import { SCENARIO_BY_ID, type ScenarioId } from '../src/sim/scenarios'
import { Sim } from '../src/sim/sim'
import { frame } from '../src/worker/pack'
import { STAT_STRIDE } from '../src/worker/protocol'

const [id = 'stable', seedArg = '1', yearsArg = '3', out] = process.argv.slice(2)
const scenario = SCENARIO_BY_ID[id as ScenarioId]
const params = deriveParams(STABLE_PRESET, scenario.species)
params.endless = true
const sim = new Sim(params, Number(seedArg), scenario.disturbance)
const days = Math.round(Number(yearsArg) * 365)
const h = new RunHistory(8760, true, scenario.species)
let resumed: RunHistory | null = null
let simMs = 0
let trackMs = 0
let saveBytes = 0
const row = new Float64Array(STAT_STRIDE)
const feed = (hist: RunHistory, f: ReturnType<typeof frame>, e: ReturnType<typeof summarizeEvolution>) => {
  hist.add(f, row, 0)
  const t0 = performance.now()
  hist.addEvolution(e, sim.ended)
  return performance.now() - t0
}
feed(h, frame(sim), summarizeEvolution(sim))
for (let d = 1; d <= days && !sim.ended; d++) {
  const t0 = performance.now()
  for (let i = 0; i < 24; i++) sim.step()
  simMs += performance.now() - t0
  const f = frame(sim)
  const e = summarizeEvolution(sim)
  trackMs += feed(h, f, e)
  if (resumed) feed(resumed, f, e)
  if (d === Math.floor(days / 2)) {
    const saved = structuredClone(h.save())
    saveBytes = JSON.stringify(saved.varieties).length
    resumed = new RunHistory(8760, true, scenario.species)
    resumed.restore(saved)
  }
  if (scenario.species.some(s => sim.pops[s].length === 0)) break
}
const varietyEntries = (x: RunHistory) => JSON.stringify(x.journal.filter(j => j.kind === 'variety'))
const same = !!resumed && JSON.stringify(resumed.varieties.save()) === JSON.stringify(h.varieties.save()) && varietyEntries(resumed) === varietyEntries(h)
const stats = Object.fromEntries(scenario.species.map(s => {
  const ds = h.varieties.days.map(d => d[s]!).filter(Boolean)
  const measured = ds.filter(d => d.split)
  let run = 0
  let best = 0
  for (const d of ds) { run = d.split?.ok ? run + 1 : 0; best = Math.max(best, run) }
  const seps = measured.map(d => d.split!.sep).sort((a, b) => a - b)
  return [s, { keptDays: ds.length, measured: measured.length, okDays: measured.filter(d => d.split!.ok).length, longestOkRun: best,
    sepMedian: seps[Math.floor(seps.length / 2)], sepP90: seps[Math.floor(seps.length * 0.9)], varietyDays: ds.filter(d => d.ids).length }]
}))
const result = { scenario: id, seed: Number(seedArg), day: Math.floor(sim.tick / 24),
  generations: Object.fromEntries(scenario.species.map(s => [s, Math.max(0, ...sim.pops[s].map(a => a.gen))])),
  simMs: Math.round(simMs), trackMs: Math.round(trackMs), trackMsPerDay: +(trackMs / Math.max(1, sim.tick / 24)).toFixed(3),
  varietySaveBytes: saveBytes, resumeMatches: same, stats,
  entries: h.journal.filter(j => j.kind === 'variety').map(j => `day ${Math.floor(j.tick / 24) + 1}: ${j.text}`) }
console.log(JSON.stringify(result, null, 1))
if (out) writeFileSync(out, JSON.stringify({ ...result, days: h.varieties.days }))
