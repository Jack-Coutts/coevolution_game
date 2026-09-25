/**
 * Paired-seed experiment for all eight interventions.
 *
 * For every seed it runs the untouched meadow, then each action once at the first hour >= 240
 * where its intended situation holds ("timely") and once where a plausible but wrong situation
 * holds ("mistimed"), fox illness at the hour a cull would be used, and a combined "keeper"
 * policy that uses the game's budget (4 charges, 400-hour cooldown). Situations are read from
 * on-screen signals only; see scripts/action-probes.ts. This is a fixed heuristic, not optimal play.
 *
 *   node --import tsx scripts/action-assay.ts 8000 40 docs/experiments/actions-tuning.json [--jobs 4]
 */
import { fork } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { STABLE_PRESET } from '../src/game/presets'
import { deriveParams } from '../src/sim/levers'
import { EFFECTS, Sim, type Counters, type Intervention } from '../src/sim/sim'
import { CHARGES, COOLDOWN, EMERGENCIES, KEEPER_ORDER, KEEPER_RESERVE, PROBES, type Signals, Watch } from './action-probes'

const FIRST_HOUR = 240
const AFTER = 720
const LOSS_WINDOW = 1440

export type Condition =
  | { kind: 'untouched' }
  | { kind: 'single'; action: Intervention; when: 'timely' | 'mistimed' | 'cullSituation' }
  | { kind: 'keeper' }
  /** Placebo: move one rabbit 0.0001 at hour 241. Measures how much any tiny change reshuffles outcomes. */
  | { kind: 'nudge' }

export function conditionName(c: Condition): string {
  return c.kind === 'single' ? `${c.action}:${c.when}` : c.kind
}

export function conditions(): Condition[] {
  return [
    { kind: 'untouched' },
    ...PROBES.flatMap(p => (['timely', 'mistimed'] as const).map(when => ({ kind: 'single' as const, action: p.action, when }))),
    { kind: 'single', action: 'illnessPred', when: 'cullSituation' },
    { kind: 'keeper' },
    { kind: 'nudge' },
  ]
}

interface IllnessTrace {
  /** Ill animals of the target species 1, 3, 7, 14 and 30 days after introduction. */
  ill: Record<'d1' | 'd3' | 'd7' | 'd14' | 'd30', number | null>
  peak: number
  peakAfterHours: number
  /** Distinct animals ever ill (within 60 days). */
  cases: number
  /** Illness deaths of the target species within 60 days. */
  deaths60: number
  /** The target species went extinct within 60 days of introduction. */
  targetExtinct60: boolean
}

export interface Row {
  seed: number
  condition: string
  /** Whether the triggering situation arose at or after hour 240 while the run was alive. */
  arose: boolean
  actions: { hour: number; action: Intervention | 'nudge'; signals: Signals }[]
  survived: boolean
  endHour: number
  extinct: 'rabbits' | 'foxes' | 'both' | null
  ceilingHits: number
  deaths: Counters
  /** Single actions: populations 30 days after the action (null if the run ended first). */
  after30: { rabbits: number; foxes: number } | null
  /** Single actions: deaths by cause in the 30 days after the action. */
  deaths30: Partial<Counters> | null
  /** Untouched only: [rabbits, foxes] at the end of each day, for paired look-ups. */
  daily?: [number, number][]
  illness?: IllnessTrace
  ms: number
}

function situationFor(c: Condition & { kind: 'single' }): (x: Signals) => boolean {
  if (c.when === 'cullSituation') return PROBES.find(p => p.action === 'cullPred')!.timely
  const probe = PROBES.find(p => p.action === c.action)!
  return c.when === 'timely' ? probe.timely : probe.mistimed
}

function diff(a: Counters, b: Counters): Partial<Counters> {
  const out: Partial<Counters> = {}
  for (const k of Object.keys(a) as (keyof Counters)[]) if (a[k] !== b[k]) out[k] = a[k] - b[k]
  return out
}

export function runOne(seed: number, c: Condition): Row {
  const t0 = performance.now()
  const s = new Sim(deriveParams(STABLE_PRESET), seed)
  const watch = new Watch()
  const actions: Row['actions'] = []
  const daily: [number, number][] = []
  let charges = CHARGES
  let cooldownUntil = 0
  let arose = false
  let at = -1
  let before: Counters | null = null
  let after30: Row['after30'] = null
  let deaths30: Row['deaths30'] = null
  const illSpecies = c.kind === 'single' && c.action.startsWith('illness') ? (c.action === 'illnessPrey' ? 'prey' : 'pred') : null
  let illness: IllnessTrace | undefined
  const everIll = new Set<number>()
  let illDeaths0 = 0

  while (s.step()) {
    const x = watch.observe(s)
    if (c.kind === 'untouched' && s.tick % 24 === 0) daily.push([x.rabbits, x.foxes])
    if (c.kind === 'single' && at < 0 && s.tick >= FIRST_HOUR && situationFor(c)(x)) {
      arose = true
      at = s.tick + 1
      s.queue(c.action)
      actions.push({ hour: at, action: c.action, signals: x })
      before = structuredClone(s.counters)
      if (illSpecies) {
        illness = { ill: { d1: null, d3: null, d7: null, d14: null, d30: null }, peak: 0, peakAfterHours: 0, cases: 0, deaths60: 0, targetExtinct60: false }
        illDeaths0 = illSpecies === 'prey' ? s.counters.preyIllness : s.counters.predIllness
      }
    }
    if (c.kind === 'nudge' && s.tick === FIRST_HOUR) {
      arose = true
      const a = s.prey[0]
      a.x = a.x < 0.5 ? a.x + 1e-4 : a.x - 1e-4
      actions.push({ hour: s.tick + 1, action: 'nudge', signals: x })
    }
    if (c.kind === 'keeper' && s.tick >= FIRST_HOUR && charges > 0 && s.tick >= cooldownUntil) {
      const probe = KEEPER_ORDER.map(a => PROBES.find(p => p.action === a)!).find(p => (charges > KEEPER_RESERVE || EMERGENCIES.includes(p.action)) && p.timely(x))
      if (probe) {
        arose = true
        s.queue(probe.action)
        actions.push({ hour: s.tick + 1, action: probe.action, signals: x })
        charges -= 1
        cooldownUntil = s.tick + COOLDOWN
      }
    }
    if (at > 0 && s.tick === at - 1 + AFTER) {
      after30 = { rabbits: s.prey.length, foxes: s.preds.length }
      deaths30 = diff(s.counters, before!)
    }
    if (illness && illSpecies && s.tick >= at && s.tick < at + LOSS_WINDOW) {
      const pop = s.pops[illSpecies]
      let ill = 0
      for (const a of pop) if (a.illUntil > s.tick) { ill++; everIll.add(a.id) }
      const since = s.tick - at + 1
      if (ill > illness.peak) { illness.peak = ill; illness.peakAfterHours = since }
      for (const [k, h] of [['d1', 24], ['d3', 72], ['d7', 168], ['d14', 336], ['d30', 720]] as const) if (since === h) illness.ill[k] = ill
      illness.deaths60 = (illSpecies === 'prey' ? s.counters.preyIllness : s.counters.predIllness) - illDeaths0
    }
  }
  if (illness && illSpecies) {
    illness.cases = everIll.size
    if (s.tick < at + LOSS_WINDOW && s.pops[illSpecies].length === 0) illness.targetExtinct60 = true
    if (s.tick < at + LOSS_WINDOW) illness.deaths60 = (illSpecies === 'prey' ? s.counters.preyIllness : s.counters.predIllness) - illDeaths0
  }
  const extinct = s.survived ? null : s.prey.length === 0 && s.preds.length === 0 ? 'both' : s.prey.length === 0 ? 'rabbits' : s.preds.length === 0 ? 'foxes' : null
  return {
    seed, condition: conditionName(c), arose, actions, survived: s.survived, endHour: s.tick, extinct,
    ceilingHits: s.ceilingHits, deaths: s.counters, after30, deaths30,
    ...(c.kind === 'untouched' ? { daily } : {}), ...(illness ? { illness } : {}),
    ms: Math.round(performance.now() - t0),
  }
}

/** Apply a JSON override to EFFECTS (exploration only; the recorded report stores the values used). */
function applyEffects(json: string | undefined): void {
  if (!json) return
  const o = JSON.parse(json) as Record<string, unknown>
  for (const [k, v] of Object.entries(o)) {
    const cur = (EFFECTS as Record<string, unknown>)[k]
    if (cur && typeof cur === 'object') Object.assign(cur, v)
    else (EFFECTS as Record<string, unknown>)[k] = v
  }
}

if (process.argv[2] === '--child') {
  applyEffects(process.env.EFFECTS_OVERRIDE)
  process.on('message', (job: { seed: number; c: Condition; i: number } | { done: true }) => {
    if ('done' in job) process.exit(0)
    process.send!({ i: job.i, row: runOne(job.seed, job.c) })
  })
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const flag = (name: string) => { const k = args.indexOf(name); return k >= 0 ? args.splice(k, 2)[1] : undefined }
  const jobsN = Number(flag('--jobs') ?? Math.min(4, os.availableParallelism()))
  const only = flag('--only')
  const override = flag('--effects')
  applyEffects(override)
  const start = Number(args[0] ?? 8000), count = Number(args[1] ?? 40), out = args[2] ?? '/tmp/actions.json'
  const conds = conditions().filter(c => !only || only.split(',').includes(conditionName(c)) || c.kind === 'untouched')
  const jobs = Array.from({ length: count }, (_, k) => conds.map(c => ({ seed: start + k, c }))).flat().map((j, i) => ({ ...j, i }))
  const rows: Row[] = new Array(jobs.length)
  const t0 = Date.now()
  let next = 0, done = 0
  await Promise.all(Array.from({ length: jobsN }, () => new Promise<void>((resolve, reject) => {
    const child = fork(fileURLToPath(import.meta.url), ['--child'], { execArgv: ['--import', 'tsx'], env: { ...process.env, EFFECTS_OVERRIDE: override ?? '' } })
    const feed = () => child.send(next < jobs.length ? jobs[next++] : { done: true })
    child.on('message', (m: { i: number; row: Row }) => {
      rows[m.i] = m.row
      if (++done % 50 === 0) process.stderr.write(`${done}/${jobs.length} runs\n`)
      feed()
    })
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`worker exited ${code}`))))
    feed()
  })))
  const wallSeconds = (Date.now() - t0) / 1000
  const report = {
    experiment: 'action-assay',
    note: 'Fixed heuristic situations read from on-screen signals; not optimal play. Exclude any pair with ceilingHits > 0 from balance claims.',
    seeds: { start, count },
    command: `node --import tsx scripts/action-assay.ts ${process.argv.slice(2).join(' ')}`,
    runtime: { node: process.version, platform: `${process.platform} ${process.arch}`, cpus: os.cpus()[0]?.model ?? '', workers: jobsN, wallSeconds },
    budget: { charges: CHARGES, cooldownHours: COOLDOWN, firstHour: FIRST_HOUR, keeperOrder: KEEPER_ORDER, keeperEmergencies: EMERGENCIES, keeperReserve: KEEPER_RESERVE },
    windows: { afterHours: AFTER, lossWindowHours: LOSS_WINDOW },
    effects: EFFECTS,
    probes: PROBES.map(p => ({ action: p.action, situation: p.situation, mistimedSituation: p.mistimedSituation, timelyRule: p.timely.toString(), mistimedRule: p.mistimed.toString() })),
    parameters: deriveParams(STABLE_PRESET),
    rows,
  }
  // One row per line keeps the report readable and diffable.
  const { rows: _r, ...head } = report
  const text = JSON.stringify(head, null, 2).replace(/\n}$/, `,\n  "rows": [\n${rows.map(r => '    ' + JSON.stringify(r)).join(',\n')}\n  ]\n}\n`)
  writeFileSync(out, text)
  process.stderr.write(`wrote ${out} in ${wallSeconds.toFixed(0)} s\n`)
}
