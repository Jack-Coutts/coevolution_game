/**
 * Paired-seed calibration for the Drought, Harsh winter and Fox invasion scenarios (issue #6).
 *
 * Each seed runs every condition on the same meadow. Every run records what the game would show:
 * the stats row the worker writes each hour, the field notes (`hints`) once a day, and the end
 * screen's explanation (`explain`). Conditions:
 *
 *   untouched  no actions
 *   keeper     the scenario-blind keeper policy from scripts/action-assay.ts (issue #4): situations
 *              read from on-screen signals, four charges, 400-hour cooldown, from hour 240
 *   informed   the scenario's intended decision (PLANS below), made on the scenario warning, with the
 *              keeper using any charges left over
 *   nudge      placebo: move one rabbit 0.0001 at hour 240, to measure how much any change reshuffles
 *
 *   node --import tsx scripts/scenario-assay.ts 8200 20 docs/experiments/scenarios-tuning.json [--jobs 2] [--scenarios drought,winter]
 *     [--conditions untouched,informed] [--disturbance '{"regrow":[...]}']   (exploration: replaces the disturbance)
 */
import { fork } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { RunHistory } from '../src/game/history'
import { explain, hints, NOTICE_DAYS } from '../src/game/insights'
import { STABLE_PRESET } from '../src/game/presets'
import { deriveParams } from '../src/sim/levers'
import { SCENARIO_BY_ID, SCENARIOS, type Scenario, type ScenarioId } from '../src/sim/scenarios'
import { Sim, type Counters, type Intervention } from '../src/sim/sim'
import { STAT_STRIDE, type FrameData } from '../src/worker/protocol'
import { writeStats } from '../src/worker/stats'
import { CHARGES, COOLDOWN, EMERGENCIES, KEEPER_ORDER, KEEPER_RESERVE, PROBES, type Signals, Watch } from './action-probes'

const FIRST_HOUR = 240
const NOTICE = NOTICE_DAYS * 24

export type Condition = 'untouched' | 'keeper' | 'informed' | 'nudge'
export const CONDITIONS: Condition[] = ['untouched', 'keeper', 'informed', 'nudge']

/** When the scenario's disturbance begins (first span, else first arrival). */
export function onset(sc: Scenario): number {
  return sc.spans[0]?.from ?? sc.markers[0]?.tick ?? Infinity
}
/** When it ends; an arrival counts as a 30-day event, as in the end-screen explanation. */
export function offset(sc: Scenario): number {
  return sc.spans[0]?.to ?? (sc.markers[0] ? sc.markers[0].tick + 30 * 24 : Infinity)
}

interface Plan {
  decision: string
  /** Keep every charge until this many hours after onset (negative: before it; -NOTICE is when the warning appears). */
  from: number
  /** Scenario-specific moves, tried before the keeper's situations whenever a charge is ready. */
  move: (x: Signals, start: number) => Intervention | null
}

/**
 * The intended player decision for each scenario, written as a fixed rule that reads only the
 * warning and on-screen counts. Chosen on tuning seeds 8200-8219, frozen before 8300-8319.
 */
export const PLANS: Record<Exclude<ScenarioId, 'stable'>, Plan> = {
  drought: {
    decision: 'Save charges for the dry months; refill bushes with rain once they are stripped during the drought.',
    from: -NOTICE,
    move: (x, start) => (x.hour >= start && x.stock < 0.25 ? 'rain' : null),
  },
  winter: {
    decision: 'Go into winter with fewer foxes: cull on the warning if there are 12 or more; rain once bushes are stripped in the cold.',
    from: -NOTICE,
    move: (x, start) => (x.hour < start ? (x.foxes >= 12 ? 'cullPred' : null) : x.stock < 0.25 ? 'rain' : null),
  },
  invasion: {
    decision: 'Save charges for the pack; cull two days after it arrives (it has spread out by then), before it eats the warren out.',
    from: 48,
    move: (x, start) => (x.hour < start + 30 * 24 && x.foxes >= 12 ? 'cullPred' : null),
  },
}

export interface Row {
  seed: number
  scenario: ScenarioId
  condition: Condition
  survived: boolean
  endHour: number
  extinct: 'rabbits' | 'foxes' | 'both' | null
  ceilingHits: number
  actions: { hour: number; action: Intervention }[]
  /** Hour the "starts in N days" field note first appeared (null if the run ended first). */
  noticeHour: number | null
  /** State when the disturbance began (null if the run ended first). */
  atOnset: { rabbits: number; foxes: number; bushes: number; stock: number } | null
  /** Lowest counts from onset to the disturbance's end (or the end of the run). */
  lowDuring: { rabbits: number; foxes: number } | null
  /** When the run ended relative to the disturbance. */
  phase: 'before' | 'during' | 'after' | 'survived'
  /** End-screen headline and a cause code derived from it. */
  headline: string
  cause: string
  /** Field-note ids shown at least once in the ten days before the collapse. */
  notesBeforeEnd: string[]
  deaths: Counters
  ms: number
}

function causeOf(headline: string): string {
  if (/survived|made it/.test(headline)) return 'survived'
  if (/illness/.test(headline)) return 'illness'
  if (/Foxes starved/.test(headline)) return /too few rabbits/.test(headline) ? 'foxes starved: too few rabbits' : 'foxes starved: could not catch'
  if (/foxes died of old age/.test(headline)) return 'foxes died of old age'
  if (/eaten out/.test(headline)) return 'rabbits eaten out'
  if (/Rabbits starved/.test(headline)) return 'rabbits starved'
  return 'rabbits died of old age'
}

export function runOne(seed: number, scenario: ScenarioId, condition: Condition): Row {
  const t0 = performance.now()
  const sc = SCENARIO_BY_ID[scenario]
  const s = new Sim(deriveParams(STABLE_PRESET), seed, sc.disturbance)
  const h = new RunHistory(s.p.horizon)
  const row = new Float64Array(STAT_STRIDE)
  const empty = new Float32Array(0)
  const record = () => {
    writeStats(s, row, 0)
    const f: FrameData = { tick: s.tick, prey: empty, preds: empty, bushes: empty, events: empty }
    h.add(f, row, 0)
  }
  record()
  const watch = new Watch()
  const plan = scenario === 'stable' ? null : PLANS[scenario]
  const start = onset(sc), stop = offset(sc)
  const actions: Row['actions'] = []
  const notes: { tick: number; ids: string[] }[] = []
  let charges = CHARGES, cooldownUntil = 0
  let noticeHour: number | null = null
  let atOnset = null as Row['atOnset']
  let lowDuring = null as Row['lowDuring']

  while (s.step()) {
    record()
    const x = watch.observe(s)
    if (s.tick % 24 === 0 || (noticeHour === null && s.tick >= start - NOTICE)) {
      const ids = hints(h, s.tick, sc).map(n => n.id)
      if (noticeHour === null && ids.includes('upcoming')) noticeHour = s.tick
      if (s.tick % 24 === 0) notes.push({ tick: s.tick, ids })
    }
    if (s.tick === start) atOnset = { rabbits: x.rabbits, foxes: x.foxes, bushes: x.bushes, stock: +x.stock.toFixed(3) }
    if (s.tick >= start && s.tick < stop) lowDuring = { rabbits: Math.min(lowDuring?.rabbits ?? Infinity, x.rabbits), foxes: Math.min(lowDuring?.foxes ?? Infinity, x.foxes) }
    if (condition === 'nudge' && s.tick === FIRST_HOUR) {
      const a = s.prey[0]
      a.x = a.x < 0.5 ? a.x + 1e-4 : a.x - 1e-4
    }
    const keeper = condition === 'keeper' || (condition === 'informed' && s.tick >= start + (plan?.from ?? 0))
    if (keeper && s.tick >= FIRST_HOUR && charges > 0 && s.tick >= cooldownUntil) {
      let action: Intervention | null = condition === 'informed' && plan ? plan.move(x, start) : null
      if (!action) action = KEEPER_ORDER.map(a => PROBES.find(p => p.action === a)!)
        .find(p => (charges > KEEPER_RESERVE || EMERGENCIES.includes(p.action)) && p.timely(x))?.action ?? null
      if (action) {
        s.queue(action)
        actions.push({ hour: s.tick + 1, action })
        charges -= 1
        cooldownUntil = s.tick + COOLDOWN
      }
    }
  }
  if (s.tick >= start) lowDuring ??= { rabbits: s.prey.length, foxes: s.preds.length }
  if (s.tick === start && !atOnset) atOnset = { rabbits: s.prey.length, foxes: s.preds.length, bushes: s.bushes.length, stock: 0 }
  const end = { tick: s.tick, survived: s.survived, preyEnd: s.prey.length, predEnd: s.preds.length }
  const headline = explain(h, end, sc).headline
  const extinct = s.survived ? null : s.prey.length === 0 && s.preds.length === 0 ? 'both' : s.prey.length === 0 ? 'rabbits' : 'foxes'
  return {
    seed, scenario, condition, survived: s.survived, endHour: s.tick, extinct, ceilingHits: s.ceilingHits, actions,
    noticeHour, atOnset, lowDuring,
    phase: s.survived ? 'survived' : s.tick < start ? 'before' : s.tick < stop ? 'during' : 'after',
    headline, cause: causeOf(headline),
    notesBeforeEnd: s.survived ? [] : [...new Set(notes.filter(n => n.tick >= s.tick - 240).flatMap(n => n.ids))].sort(),
    deaths: s.counters,
    ms: Math.round(performance.now() - t0),
  }
}

/** Exploration only: replace the disturbance of the scenarios being run (the report records what was used). */
function applyDisturbance(json: string | undefined, ids: ScenarioId[]): void {
  if (!json) return
  for (const id of ids) Object.assign(SCENARIO_BY_ID[id].disturbance, JSON.parse(json))
}

if (process.argv[2] === '--child') {
  applyDisturbance(process.env.DISTURBANCE_OVERRIDE, (process.env.DISTURBANCE_SCENARIOS ?? '').split(',') as ScenarioId[])
  process.on('message', (job: { seed: number; scenario: ScenarioId; condition: Condition; i: number } | { done: true }) => {
    if ('done' in job) process.exit(0)
    process.send!({ i: job.i, row: runOne(job.seed, job.scenario, job.condition) })
  })
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const flag = (name: string) => { const k = args.indexOf(name); return k >= 0 ? args.splice(k, 2)[1] : undefined }
  const jobsN = Number(flag('--jobs') ?? 2)
  const scenarios = (flag('--scenarios')?.split(',') ?? ['drought', 'winter', 'invasion']) as ScenarioId[]
  const conds = (flag('--conditions')?.split(',') ?? CONDITIONS) as Condition[]
  const override = flag('--disturbance')
  applyDisturbance(override, scenarios)
  const start = Number(args[0] ?? 8200), count = Number(args[1] ?? 20), out = args[2] ?? '/tmp/scenarios.json'
  const jobs = scenarios.flatMap(scenario => Array.from({ length: count }, (_, k) => conds.map(condition => ({ seed: start + k, scenario, condition }))).flat())
    .map((j, i) => ({ ...j, i }))
  const rows: Row[] = new Array(jobs.length)
  const t0 = Date.now()
  let next = 0, done = 0
  await Promise.all(Array.from({ length: jobsN }, () => new Promise<void>((resolve, reject) => {
    const child = fork(fileURLToPath(import.meta.url), ['--child'], { execArgv: ['--import', 'tsx'], env: { ...process.env, DISTURBANCE_OVERRIDE: override ?? '', DISTURBANCE_SCENARIOS: scenarios.join(',') } })
    const feed = () => child.send(next < jobs.length ? jobs[next++] : { done: true })
    child.on('message', (m: { i: number; row: Row }) => {
      rows[m.i] = m.row
      if (++done % 20 === 0) process.stderr.write(`${done}/${jobs.length} runs\n`)
      feed()
    })
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`worker exited ${code}`))))
    feed()
  })))
  const wallSeconds = (Date.now() - t0) / 1000
  const report = {
    experiment: 'scenario-assay',
    note: 'Fixed rules reading on-screen signals and the scenario warning; not optimal play. Exclude any seed with ceilingHits > 0 in any condition from claims.',
    seeds: { start, count },
    command: `node --import tsx scripts/scenario-assay.ts ${process.argv.slice(2).join(' ')}`,
    runtime: { node: process.version, platform: `${process.platform} ${process.arch}`, cpus: os.cpus()[0]?.model ?? '', workers: jobsN, wallSeconds },
    budget: { charges: CHARGES, cooldownHours: COOLDOWN, firstHour: FIRST_HOUR, keeperOrder: KEEPER_ORDER, keeperEmergencies: EMERGENCIES, keeperReserve: KEEPER_RESERVE },
    noticeDays: NOTICE_DAYS,
    scenarios: SCENARIOS.filter(s => scenarios.includes(s.id)).map(s => ({
      id: s.id, disturbance: s.disturbance, onset: onset(s), end: offset(s),
      decision: s.id === 'stable' ? null : PLANS[s.id].decision, from: s.id === 'stable' ? null : PLANS[s.id].from,
      move: s.id === 'stable' ? null : PLANS[s.id].move.toString(),
    })),
    parameters: deriveParams(STABLE_PRESET),
    rows,
  }
  const { rows: _r, ...head } = report
  const text = JSON.stringify(head, null, 2).replace(/\n}$/, `,\n  "rows": [\n${rows.map(r => '    ' + JSON.stringify(r)).join(',\n')}\n  ]\n}\n`)
  writeFileSync(out, text)
  process.stderr.write(`wrote ${out} in ${wallSeconds.toFixed(0)} s\n`)
}
