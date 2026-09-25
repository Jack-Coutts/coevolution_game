/**
 * Situation discovery for the action assay (tuning seeds only).
 *
 * Runs each seed untouched, checkpoints every `--every` hours from hour 240, then branches each
 * checkpoint with one action for 60 days. Records on-screen signals at the decision and the
 * short-horizon outcome against the untouched run: extinction within 60 days and each species'
 * lowest count over that window. Used to choose the situations in scripts/action-probes.ts.
 *
 *   node --import tsx scripts/action-explore.ts 8000 40 out.json [--every 240] [--effects '{"cullDivisor":2}']
 *   node --import tsx scripts/action-explore.ts 8100 100 out.json --every 480 --evaluate   # held-out check of frozen probes
 *   node --import tsx scripts/action-explore.ts --summarise summary.json label=out.json ...
 */
import { fork } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { STABLE_PRESET } from '../src/game/presets'
import { deriveParams } from '../src/sim/levers'
import { EFFECTS, Sim, type Intervention } from '../src/sim/sim'
import { PROBES, type Signals, Watch } from './action-probes'

const WINDOW = 1440
const ALL: Intervention[] = ['rain', 'plantBushes', 'releasePrey', 'releasePred', 'cullPred', 'feedFoxes', 'illnessPrey', 'illnessPred']

export interface Branch {
  seed: number
  hour: number
  action: Intervention
  signals: Signals
  /** Untouched and treated: lost = a species died out within the window. */
  lost: [boolean, boolean]
  minRabbits: [number, number]
  minFoxes: [number, number]
  rabbits30: [number, number] | null
  foxes30: [number, number] | null
  ceilingHits: number
}

function explore(seed: number, every: number, actions: Intervention[]): Branch[] {
  const s = new Sim(deriveParams(STABLE_PRESET), seed)
  const watch = new Watch()
  const counts: [number, number][] = []
  const checkpoints: { hour: number; save: ReturnType<Sim['save']>; signals: Signals; watch: Watch }[] = []
  while (s.step()) {
    const x = watch.observe(s)
    counts[s.tick] = [s.prey.length, s.preds.length]
    if (s.tick >= 240 && (s.tick - 240) % every === 0) checkpoints.push({ hour: s.tick, save: structuredClone(s.save()), signals: x, watch: structuredClone(watch) })
  }
  counts[s.tick] = [s.prey.length, s.preds.length]
  const end = s.tick
  const out: Branch[] = []
  for (const cp of checkpoints) {
    const stop = cp.hour + WINDOW
    let uMinR = Infinity, uMinF = Infinity
    for (let t = cp.hour + 1; t <= Math.min(stop, end); t++) { uMinR = Math.min(uMinR, counts[t][0]); uMinF = Math.min(uMinF, counts[t][1]) }
    const uLost = !s.survived && end <= stop
    for (const action of actions) {
      const b = Sim.restore(structuredClone(cp.save))
      b.queue(action)
      let minR = Infinity, minF = Infinity, r30: number | null = null, f30: number | null = null
      while (b.tick < stop && b.step()) {
        minR = Math.min(minR, b.prey.length); minF = Math.min(minF, b.preds.length)
        if (b.tick === cp.hour + 720) { r30 = b.prey.length; f30 = b.preds.length }
      }
      if (b.ended) { minR = Math.min(minR, b.prey.length); minF = Math.min(minF, b.preds.length) }
      const u30 = counts[cp.hour + 720]
      out.push({
        seed, hour: cp.hour + 1, action, signals: cp.signals,
        lost: [uLost, b.ended && !b.survived],
        minRabbits: [uMinR, minR], minFoxes: [uMinF, minF],
        rabbits30: r30 !== null && u30 ? [u30[0], r30] : null,
        foxes30: f30 !== null && u30 ? [u30[1], f30] : null,
        ceilingHits: b.ceilingHits,
      })
    }
  }
  return out
}

function applyEffects(json: string | undefined): void {
  if (!json) return
  for (const [k, v] of Object.entries(JSON.parse(json) as Record<string, unknown>)) {
    const cur = (EFFECTS as Record<string, unknown>)[k]
    if (cur && typeof cur === 'object') Object.assign(cur, v)
    else (EFFECTS as Record<string, unknown>)[k] = v
  }
}

/** Candidate situations compared during tuning (the chosen ones are in action-probes.ts). */
export const CANDIDATES: Record<string, (x: Signals) => boolean> = {
  any: () => true,
  'foxes <= 5': x => x.foxes <= 5,
  'foxes <= 6': x => x.foxes <= 6,
  'foxes <= 8': x => x.foxes <= 8,
  'foxes <= 6, energy < 40%': x => x.foxes <= 6 && x.foxEnergy < 0.4,
  'foxes <= 8, bushes < 30% full': x => x.foxes <= 8 && x.stock < 0.3,
  'overhunt (10+ foxes, < 5 rabbits/fox, rabbits -15%/10 d)': x => x.foxes >= 10 && x.rabbits < 5 * x.foxes && x.rabbitTrend < -0.15,
  'fox-heavy (20+ foxes, < 8 rabbits/fox)': x => x.foxes >= 20 && x.rabbits < 8 * x.foxes,
  'fox boom (+50%/10 d, 6+ foxes)': x => x.foxTrend > 0.5 && x.foxes >= 6,
  'rabbits <= 30': x => x.rabbits <= 30,
  'rabbits <= 60': x => x.rabbits <= 60,
  'rabbits >= 300, bushes < 20% full': x => x.rabbits >= 300 && x.stock < 0.2,
  'rabbits >= 250, foxes >= 20': x => x.rabbits >= 250 && x.foxes >= 20,
  'rabbits >= 250, foxes <= 10': x => x.rabbits >= 250 && x.foxes <= 10,
  'rabbit boom (+40%/10 d, bushes < 35%)': x => x.rabbitTrend > 0.4 && x.stock < 0.35,
  'bushes <= 16': x => x.bushes <= 16,
  'bushes <= 20': x => x.bushes <= 20,
  'bushes <= 20, < 20% full': x => x.bushes <= 20 && x.stock < 0.2,
  'bushes >= 40': x => x.bushes >= 40,
  'bushes < 15% full, rabbits < 35% energy': x => x.stock < 0.15 && x.rabbitEnergy < 0.35,
  'bushes >= 60% full': x => x.stock >= 0.6,
}

const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1] }
const logRatio = (a: number, b: number) => Math.log((b + 1) / (a + 1))

/** Per action and candidate situation: branches, untouched losses, losses prevented / caused, median log changes. */
export function summarise(rows: Branch[]) {
  const out: Record<string, Record<string, unknown>> = {}
  for (const action of [...new Set(rows.map(r => r.action))]) {
    out[action] = {}
    const probe = PROBES.find(p => p.action === action)!
    const situations: [string, (x: Signals) => boolean, number][] = [
      ['probe: timely', probe.timely, 1], ['probe: mistimed', probe.mistimed, 1],
      ...Object.entries(CANDIDATES).map(([k, f]) => [k, f, 5] as [string, (x: Signals) => boolean, number]),
    ]
    for (const [name, f, min] of situations) {
      const rs = rows.filter(r => r.action === action && r.ceilingHits === 0 && f(r.signals))
      if (rs.length < min) continue
      const round = (x: number | null) => (x === null ? null : Math.round(x * 100) / 100)
      out[action][name] = {
        branches: rs.length,
        untouchedLost: rs.filter(r => r.lost[0]).length,
        prevented: rs.filter(r => r.lost[0] && !r.lost[1]).length,
        caused: rs.filter(r => !r.lost[0] && r.lost[1]).length,
        logMinRabbits: round(median(rs.map(r => logRatio(r.minRabbits[0], r.minRabbits[1])))),
        logMinFoxes: round(median(rs.map(r => logRatio(r.minFoxes[0], r.minFoxes[1])))),
        logRabbits30d: round(median(rs.filter(r => r.rabbits30).map(r => logRatio(r.rabbits30![0], r.rabbits30![1])))),
        logFoxes30d: round(median(rs.filter(r => r.foxes30).map(r => logRatio(r.foxes30![0], r.foxes30![1])))),
      }
    }
  }
  return out
}

if (process.argv[2] === '--summarise') {
  // node --import tsx scripts/action-explore.ts --summarise out.json label=raw.json ...
  const [, , , out, ...inputs] = process.argv
  const variants = inputs.map(arg => {
    const [label, file] = arg.split('=')
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { rows: Branch[]; effects: unknown; every: number; seeds: unknown; runtime: unknown }
    return { label, effects: raw.effects, seeds: raw.seeds, every: raw.every, runtime: raw.runtime, branches: raw.rows.length, summary: summarise(raw.rows) }
  })
  writeFileSync(out, JSON.stringify({
    experiment: 'action-explore',
    note: 'Tuning seeds only. Each branch applies one action at a checkpoint and runs 60 days; prevented/caused count extinctions within 60 days against the untouched run. Log values are medians of ln((treated+1)/(untouched+1)); positive means more animals.',
    windowHours: WINDOW,
    variants,
  }, null, 1) + '\n')
} else if (process.argv[2] === '--child') {
  applyEffects(process.env.EFFECTS_OVERRIDE)
  process.on('message', (job: { seed: number; every: number; actions: Intervention[] } | { done: true }) => {
    if ('done' in job) process.exit(0)
    process.send!({ seed: job.seed, rows: explore(job.seed, job.every, job.actions) })
  })
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const flag = (name: string) => { const k = args.indexOf(name); return k >= 0 ? args.splice(k, 2)[1] : undefined }
  const every = Number(flag('--every') ?? 240)
  const override = flag('--effects')
  const actions = (flag('--actions')?.split(',') ?? ALL) as Intervention[]
  const workers = Number(flag('--jobs') ?? Math.min(4, os.availableParallelism()))
  applyEffects(override)
  const evaluate = args.includes('--evaluate')
  if (evaluate) args.splice(args.indexOf('--evaluate'), 1)
  const [start, count, out] = [Number(args[0] ?? 8000), Number(args[1] ?? 40), args[2] ?? '/tmp/explore.json']
  if (!evaluate && start + count > 8100 && start < 8200) throw new Error('Tuning exploration must not use evaluation seeds 8100-8199; pass --evaluate only after the probes are frozen.')
  const seeds = Array.from({ length: count }, (_, k) => start + k)
  const results: Branch[][] = []
  const t0 = Date.now()
  let next = 0
  await Promise.all(Array.from({ length: workers }, () => new Promise<void>((resolve, reject) => {
    const child = fork(fileURLToPath(import.meta.url), ['--child'], { execArgv: ['--import', 'tsx'], env: { ...process.env, EFFECTS_OVERRIDE: override ?? '' } })
    const feed = () => child.send(next < seeds.length ? { seed: seeds[next++], every, actions } : { done: true })
    child.on('message', (m: { seed: number; rows: Branch[] }) => { results[m.seed - start] = m.rows; process.stderr.write(`seed ${m.seed}\n`); feed() })
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`worker exited ${code}`))))
    feed()
  })))
  const rows = results.flat()
  const head = { experiment: 'action-explore', seeds: { start, count }, every, windowHours: WINDOW, effects: EFFECTS, runtime: { node: process.version, wallSeconds: (Date.now() - t0) / 1000 } }
  writeFileSync(out, JSON.stringify(head, null, 2).replace(/\n}$/, `,\n  "rows": [\n${rows.map(r => '    ' + JSON.stringify(r)).join(',\n')}\n  ]\n}\n`))
  process.stderr.write(`wrote ${out}\n`)
}
