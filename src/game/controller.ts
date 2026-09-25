import { writeSave, type MeadowSave } from './saves'
import { chargesAt, COOLDOWN, nextRenewal } from './budget'
import { BUDGET, deriveParams, spent, type LeverValues } from '@/sim/levers'
import type { SimParams } from '@/sim/params'
import { SCENARIO_BY_ID, type Scenario, type ScenarioId } from '@/sim/scenarios'
import type { Intervention, Sim } from '@/sim/sim'
import { tickAt } from '@/sim/time'
import { WorldRenderer, type Weather } from '@/render/renderer'
import { STAT_STRIDE, type EndInfo, type FrameData, type FromWorker, type ToWorker } from '@/worker/protocol'
import SimWorker from '@/worker/sim.worker.ts?worker'
import { RunHistory } from './history'
import { explain, hints, newDangers, type Explanation, type Hint } from './insights'
import { recordScore, scoreFor, scoreRun, type BestScore, type ScoreBreakdown } from './scores'

export type Phase = 'loading' | 'planning' | 'running' | 'ended'

export interface RunConfig {
  levers: LeverValues
  base: LeverValues
  scenario: ScenarioId
  seed: number
  endless: boolean
}

export const SPEEDS = [
  { label: '12 h/s', tps: 12 },
  { label: '1 d/s', tps: 24 },
  { label: '3 d/s', tps: 72 },
  { label: '1 wk/s', tps: 168 },
  { label: '2 wk/s', tps: 336 },
  { label: '1 mo/s', tps: 720 },
]
export const DEFAULT_SPEED = 1

/** Resetting a run that has gone further than this asks first; planning resets stay instant. */
export const RESET_CONFIRM_HOURS = 7 * 24

const AUTO_PAUSE_KEY = 'coevo-game:pause-on-warning'

function readAutoPause(): boolean {
  try {
    return localStorage.getItem(AUTO_PAUSE_KEY) !== 'off'
  } catch {
    return true
  }
}

export { CHARGES, COOLDOWN } from './budget'

export interface Snapshot {
  phase: Phase
  playing: boolean
  tick: number
  head: number
  horizon: number
  endless: boolean
  saveStatus: string
  speed: number
  prey: number
  pred: number
  stock: number
  bushes: number
  preyEnergy: number
  predEnergy: number
  predKits10d: number
  end: EndInfo | null
  explanation: Explanation | null
  score: ScoreBreakdown | null
  best: BestScore | null
  newBest: boolean
  hints: Hint[]
  /** Uses available at the displayed hour. */
  charges: number
  /** Endless only: the hour the next use renews (the next season start); null in the one-year challenge. */
  nextRenewal: number | null
  cooldownUntil: number
  atLive: boolean
  interventions: { tick: number; action: Intervention }[]
  runId: number
  /** Pause when a new red field note appears (a per-device preference). */
  autoPause: boolean
  /** The warning that just paused the meadow, until the player plays again. */
  pausedFor: Hint | null
  /** Hours per second actually shown, when the simulation cannot keep up with the chosen speed; otherwise null. */
  effectiveTps: number | null
}

const WINTER = [tickAt(3), tickAt(6)] as const
const SUMMER = tickAt(9)
const RAMP = 10 * 24

function span(t: number, from: number, to: number): number {
  const a = Math.min(1, Math.max(0, (t - from + RAMP) / (2 * RAMP)))
  const b = Math.min(1, Math.max(0, (to + RAMP - t) / (2 * RAMP)))
  return Math.min(a, b)
}

export class GameController {
  history: RunHistory = new RunHistory(8760)
  params: SimParams | null = null
  scenario: Scenario = SCENARIO_BY_ID.stable
  config: RunConfig | null = null
  cover: [number, number][] = []
  private saveStatus = ''
  private saving = false
  private worker: Worker
  private renderer: WorldRenderer | null = null
  private rendererAttached = false
  private runId = 0
  private displayTick = 0
  private playing = false
  private speed = DEFAULT_SPEED
  private phase: Phase = 'loading'
  private end: EndInfo | null = null
  private stepTarget: number | null = null
  private inflight = false
  /** An intervention is on its way to the worker; hold the display and advance requests until it lands. */
  private intervening = false
  private refund: number | null = null
  private raf = 0
  private last = 0
  private lastFxTick = 0
  /** The hour of an intervention sent to the worker but not yet recorded; it already counts as spent. */
  private pendingAt: number | null = null
  private cooldownUntil = 0
  private listeners = new Set<() => void>()
  private snap: Snapshot
  private lastNotify = 0
  private finalized = false
  private explanation: Explanation | null = null
  private score: ScoreBreakdown | null = null
  private best: BestScore | null = null
  private newBest = false
  private hintCache: { tick: number; hints: Hint[] } = { tick: -1, hints: [] }
  private autoPause = readAutoPause()
  private pausedFor: Hint | null = null
  private rate: { since: number; from: number; tps: number | null } = { since: 0, from: 0, tps: null }
  /** The hour and notes the warning watch last saw; -1 after a jump, so the next check only takes a baseline. */
  private watched: { tick: number; hints: Hint[] } = { tick: -1, hints: [] }

  constructor() {
    this.worker = new SimWorker()
    this.worker.onmessage = (ev: MessageEvent<FromWorker>) => this.onMessage(ev.data)
    this.snap = this.makeSnapshot()
    this.loop = this.loop.bind(this)
    this.raf = requestAnimationFrame(this.loop)
  }

  dispose(): void {
    cancelAnimationFrame(this.raf)
    this.worker.terminate()
  }

  /** Detaching keeps the renderer, so returning to the meadow reuses its painted terrain and sprites (~30 ms to rebuild). */
  attachCanvas(canvas: HTMLCanvasElement | null): void {
    this.rendererAttached = canvas !== null
    if (!canvas) {
      this.renderer?.releaseCanvas()
      return
    }
    if (this.renderer) this.renderer.setCanvas(canvas)
    else this.renderer = new WorldRenderer(canvas)
    if (this.params) this.renderer.setWorld(this.cover, this.params.eco.coverR, this.config?.seed ?? 0, this.params.patchStock)
  }

  resize(cssSize: number): void {
    this.renderer?.resize(cssSize, Math.min(2, window.devicePixelRatio || 1))
  }

  worldToCss(x: number, y: number): [number, number] {
    return this.renderer?.worldToCss(x, y) ?? [0, 0]
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot = (): Snapshot => this.snap

  private notify(force = false): void {
    const now = performance.now()
    if (!force && now - this.lastNotify < 100) return
    this.lastNotify = now
    this.snap = this.makeSnapshot()
    for (const fn of this.listeners) fn()
  }

  private makeSnapshot(): Snapshot {
    const t = Math.floor(this.displayTick)
    const h = this.history
    const p = this.params
    if (p) this.hintsAt(t)
    return {
      phase: this.phase,
      playing: this.playing,
      tick: t,
      head: h.head,
      horizon: h.horizon,
      endless: this.config?.endless ?? false,
      saveStatus: this.saveStatus,
      speed: this.speed,
      prey: h.stat(t, 'prey'),
      pred: h.stat(t, 'pred'),
      stock: h.stat(t, 'stock'),
      bushes: h.stat(t, 'bushes'),
      preyEnergy: h.stat(t, 'preyEnergy'),
      predEnergy: h.stat(t, 'predEnergy'),
      predKits10d: h.stat(t, 'predBorn') - h.stat(Math.max(0, t - 240), 'predBorn'),
      end: this.end,
      explanation: this.explanation,
      score: this.score,
      best: this.best,
      newBest: this.newBest,
      hints: this.hintCache.hints,
      charges: this.chargesAt(t),
      nextRenewal: this.config?.endless ? nextRenewal(t) : null,
      cooldownUntil: this.cooldownUntil,
      atLive: this.atLive(),
      interventions: h.interventions,
      runId: this.runId,
      autoPause: this.autoPause,
      pausedFor: this.pausedFor,
      effectiveTps: this.playing ? this.rate.tps : null,
    }
  }

  /** Measure the shown rate over ~2 s windows; flag it when it falls below 80% of the chosen speed. */
  private measureRate(now: number): void {
    const r = this.rate
    if (!this.playing || this.intervening || r.since === 0) {
      this.rate = { since: now, from: this.displayTick, tps: this.playing ? r.tps : null }
      return
    }
    const elapsed = (now - r.since) / 1000
    if (elapsed < 2) return
    const shown = (this.displayTick - r.from) / elapsed
    const lagging = shown < 0.8 * SPEEDS[this.speed].tps && !(this.end && this.displayTick >= this.end.tick)
    this.rate = { since: now, from: this.displayTick, tps: lagging ? shown : null }
    this.notify(true)
  }

  private resetRate(): void {
    this.rate = { since: 0, from: 0, tps: null }
  }

  private hintsAt(t: number): Hint[] {
    if (this.hintCache.tick !== t) this.hintCache = { tick: t, hints: hints(this.history, t) }
    return this.hintCache.hints
  }

  setAutoPause(on: boolean): void {
    this.autoPause = on
    try {
      localStorage.setItem(AUTO_PAUSE_KEY, on ? 'on' : 'off')
    } catch {
      /* storage unavailable: the choice lasts for this visit */
    }
    this.notify(true)
  }

  /** While playing live, pause once when a red field note appears that was not showing an hour or so earlier. */
  private watchWarnings(t: number): void {
    const prev = this.watched
    if (t === prev.tick) return
    const now = this.hintsAt(t)
    this.watched = { tick: t, hints: now }
    if (!this.autoPause || this.phase !== 'running' || prev.tick < 0 || t < prev.tick || t - prev.tick > 48) return
    const fresh = newDangers(prev.hints, now)
    if (fresh.length === 0) return
    this.pause()
    this.pausedFor = fresh[0]
    this.notify(true)
  }

  private atLive(): boolean {
    return this.history.head - this.displayTick < Math.max(8, SPEEDS[this.speed].tps * 0.6)
  }

  /** Start a fresh run at tick 0 (planning phase). */
  configure(config: RunConfig, state?: ReturnType<Sim['save']>): void {
    this.config = config
    this.params = deriveParams(config.levers)
    this.params.endless = config.endless
    this.scenario = SCENARIO_BY_ID[config.scenario]
    this.runId += 1
    this.history = new RunHistory(this.params.horizon, config.endless)
    this.saveStatus = ''
    this.saving = false
    this.hintCache = { tick: -1, hints: [] }
    this.watched = { tick: -1, hints: [] }
    this.pausedFor = null
    this.resetRate()
    this.displayTick = 0
    this.lastFxTick = 0
    this.playing = false
    this.phase = 'loading'
    this.stepTarget = null
    this.end = null
    this.inflight = false
    this.intervening = false
    this.refund = null
    this.finalized = false
    this.explanation = null
    this.score = null
    this.newBest = false
    this.pendingAt = null
    this.cooldownUntil = 0
    this.best = scoreFor(config)
    this.renderer?.clearFx()
    this.send(state ? { type: 'restore', runId: this.runId, state } : {
      type: 'init',
      runId: this.runId,
      params: this.params,
      seed: config.seed,
      disturbance: this.scenario.disturbance,
    })
    this.notify(true)
  }

  private send(msg: ToWorker): void {
    this.worker.postMessage(msg)
  }

  private onMessage(msg: FromWorker): void {
    if (msg.runId !== this.runId) return
    switch (msg.type) {
      case 'ready':
        this.cover = msg.cover
        this.history.add(msg.frame, msg.stats, 0)
        this.history.addEvolution(msg.evolution)
        this.phase = msg.restored ? 'running' : 'planning'
        if (msg.restored) { this.displayTick = msg.frame.tick; this.end = msg.end ?? null; if (this.end) this.finalize() }
        if (this.renderer && this.params && this.config) {
          this.renderer.setWorld(msg.cover, this.params.eco.coverR, this.config.seed, this.params.patchStock)
        }
        this.notify(true)
        break
      case 'frames':
        this.inflight = false
        msg.frames.forEach((f: FrameData, i: number) => this.history.add(f, msg.stats, i * STAT_STRIDE))
        msg.evolution.forEach(e => this.history.addEvolution(e))
        if (msg.end) this.end = msg.end
        if (this.stepTarget !== null) {
          this.displayTick = Math.min(this.history.head, this.stepTarget)
          if (this.history.head < this.stepTarget && !this.end) {
            this.inflight = true
            this.send({ type: 'advance', runId: this.runId, target: this.stepTarget })
          } else {
            this.stepTarget = null
            if (this.end && this.displayTick >= this.end.tick) this.finalize()
          }
        }
        this.notify()
        break
      case 'saved': {
        if (!this.config) break
        this.displayTick = msg.state.tick
        const save: MeadowSave = { version: 2, savedAt: new Date().toISOString(), config: this.config,
          state: msg.state, history: this.history.save(), charges: this.chargesAt(Math.floor(this.displayTick)), cooldownUntil: this.cooldownUntil,
          interventions: this.history.interventions, evolution: this.history.evolution, journal: this.history.journal }
        const id = this.runId
        void writeSave(save).then(() => {
          if (id !== this.runId) return
          this.saving = false
          this.saveStatus = 'Meadow saved on this device.'
          this.notify(true)
        }).catch(() => {
          if (id !== this.runId) return
          this.saving = false
          this.saveStatus = 'Could not save: device storage is unavailable or full.'
          this.notify(true)
        })
        break
      }
      case 'intervened': {
        this.intervening = false
        // Any advance sent before the intervention has already answered, and none was sent after it.
        this.inflight = false
        if (msg.tick === msg.from) {
          // The run had already ended at that hour: nothing was applied, so the use was never spent.
          this.pendingAt = null
          this.cooldownUntil = this.refund ?? 0
          this.refund = null
          this.notify(true)
          break
        }
        this.refund = null
        this.pendingAt = null
        this.history.truncate(msg.from)
        this.history.add(msg.frame, msg.stats, 0)
        msg.evolution.forEach(e => this.history.addEvolution(e))
        this.end = msg.end
        this.displayTick = msg.tick
        this.lastFxTick = msg.tick
        if (this.renderer && this.rendererAttached) this.renderer.addEvents(msg.frame, performance.now(), false)
        this.cooldownUntil = msg.from + COOLDOWN
        this.history.interventions = [...this.history.interventions, { tick: msg.tick, action: msg.action }]
        if (this.end && this.displayTick >= this.end.tick) this.finalize()
        this.notify(true)
        break
      }
      default: {
        const never: never = msg
        throw new Error(`unknown message ${String(never)}`)
      }
    }
  }

  play(): void {
    if (this.phase === 'loading' || this.saving) return
    if (this.phase === 'planning' && this.budgetLeft() < 0) return
    if (this.phase === 'ended' && this.displayTick >= this.history.head) this.displayTick = this.history.replayStart
    if (this.phase === 'planning') this.phase = 'running'
    this.playing = true
    this.pausedFor = null
    this.resetRate()
    this.last = performance.now()
    this.notify(true)
  }

  pause(): void {
    this.stepTarget = null
    this.playing = false
    this.notify(true)
  }

  toggle(): void {
    if (this.playing) this.pause()
    else this.play()
  }

  setSpeed(i: number): void {
    this.speed = Math.max(0, Math.min(SPEEDS.length - 1, i))
    this.resetRate()
    this.notify(true)
  }

  /** Jump the view to a tick already simulated (scrub). */
  seek(tick: number): void {
    this.stepTarget = null
    this.displayTick = Math.max(this.history.replayStart, Math.min(this.history.head, tick))
    this.watched = { tick: -1, hints: [] }
    this.resetRate()
    this.lastFxTick = Math.floor(this.displayTick)
    this.renderer?.clearFx()
    if (this.end && this.displayTick >= this.end.tick) this.finalize()
    this.notify(true)
  }

  /** Step forward or back by `n` ticks; stepping past the head simulates when running. */
  stepBy(n: number): void {
    if (this.intervening) return
    this.pause()
    const target = Math.round(this.displayTick + n)
    if (target > this.history.head && !this.end && this.phase !== 'loading' && !this.saving) {
      if (this.phase === 'planning' && this.budgetLeft() < 0) return
      if (this.phase === 'planning') this.phase = 'running'
      this.stepTarget = target
      if (!this.inflight) {
        this.send({ type: 'advance', runId: this.runId, target })
        this.inflight = true
      }
    } else this.seek(target)
  }

  save(): void {
    if (this.phase === 'loading' || this.saving) return
    this.pause()
    this.saving = true
    this.saveStatus = 'Saving meadow…'
    this.send({ type: 'save', runId: this.runId, at: Math.floor(this.displayTick) })
    this.notify(true)
  }

  restore(save: MeadowSave): void {
    this.configure(save.config, save.state)
    this.history.restore(save.history)
    // Uses are recomputed from the recorded interventions, so a save can neither duplicate nor lose one; the stored
    // `charges` is only for older builds. Saves from before a field existed get its empty default.
    this.cooldownUntil = save.cooldownUntil ?? 0
    this.history.interventions = save.interventions ?? []
    this.history.evolution = save.evolution ?? []
    this.history.journal = save.journal ?? []
    this.saveStatus = 'Meadow restored and paused. The graph and journal are kept; replay covers the last 15 days before the save.'
  }

  /** The worker may already have simulated past the displayed hour (even to the end); what counts is what the player sees. */
  canIntervene(): boolean {
    const t = Math.floor(this.displayTick)
    return (
      this.phase === 'running' &&
      (!this.end || t < this.end.tick) &&
      !this.saving &&
      !this.intervening &&
      this.chargesAt(t) > 0 &&
      t >= this.cooldownUntil &&
      this.atLive()
    )
  }

  /** Act at the displayed hour. The effect shows one hour later, straight away even while paused. */
  intervene(action: Intervention): void {
    if (!this.canIntervene()) return
    const at = Math.floor(this.displayTick)
    this.pendingAt = at
    this.refund = this.cooldownUntil
    this.cooldownUntil = at + COOLDOWN
    this.stepTarget = null
    this.intervening = true
    this.send({ type: 'intervene', runId: this.runId, action, at })
    this.notify(true)
  }

  /** Uses available at hour `t`. A recorded intervention was made the hour before its `tick` (the effect shows one hour later). */
  private chargesAt(t: number): number {
    const spentAt = this.history.interventions.map(iv => iv.tick - 1)
    if (this.pendingAt !== null) spentAt.push(this.pendingAt)
    return chargesAt(spentAt, t, this.config?.endless ?? false)
  }

  resetNeedsConfirm(): boolean {
    return (this.phase === 'running' || this.phase === 'ended') && this.history.head > RESET_CONFIRM_HOURS
  }

  budgetLeft(): number {
    if (!this.config) return BUDGET
    return BUDGET - spent(this.config.levers, this.config.base)
  }

  weather(tick: number): Weather {
    if (this.config?.endless) tick %= 8760
    const harsh = this.scenario.spans.some((s) => s.tone === 'winter')
    let dry = 0.35 * span(tick, SUMMER, Infinity)
    for (const s of this.scenario.spans) if (s.tone === 'drought') dry = Math.max(dry, span(tick, s.from, s.to))
    return {
      snow: span(tick, WINTER[0], WINTER[1]) * (harsh ? 0.95 : 0.4),
      warm: span(tick, -Infinity, WINTER[0]),
      dry,
    }
  }

  private finalize(): void {
    if (this.finalized || !this.end || !this.params || !this.config) return
    this.finalized = true
    this.phase = 'ended'
    this.playing = false
    this.explanation = explain(this.history, this.end, this.scenario)
    const used = spent(this.config.levers, this.config.base)
    this.score = scoreRun(this.end.tick, this.end.survived, used, this.history.interventions.length)
    const prev = this.best
    this.best = recordScore(this.config, this.score.total, this.end.tick)
    this.newBest = !prev || this.score.total > prev.score
  }

  private loop(now: number): void {
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(100, now - this.last)
    this.last = now
    const h = this.history
    const tps = SPEEDS[this.speed].tps
    if (this.playing && !this.intervening) {
      this.displayTick += (dt / 1000) * tps
      if (this.displayTick >= h.head) {
        this.displayTick = h.head
        if (this.end && h.head >= this.end.tick) this.finalize()
      }
    }
    if (!this.end && this.phase === 'running' && this.playing && !this.inflight && !this.intervening) {
      const lead = Math.max(6, tps * 0.25)
      if (h.head < this.displayTick + lead) {
        this.inflight = true
        this.send({ type: 'advance', runId: this.runId, target: Math.ceil(this.displayTick + lead) })
      }
    }
    this.measureRate(now)
    const t = Math.floor(this.displayTick)
    if (this.playing && this.atLive()) this.watchWarnings(t)
    else this.watched = { tick: -1, hints: [] }
    if (this.renderer && this.rendererAttached) {
      if (this.playing && t > this.lastFxTick && t - this.lastFxTick < 40) {
        for (let k = this.lastFxTick + 1; k <= t; k++) {
          const f = h.frame(k)
          if (f) this.renderer.addEvents(f, now, tps > 72)
        }
      }
      this.lastFxTick = t
      const fr = h.frameAt(this.displayTick)
      if (fr) this.renderer.draw(fr.a, fr.b, fr.alpha, this.weather(this.displayTick), now)
    }
    this.notify(this.phase === 'ended' && this.snap.phase !== 'ended')
  }

  get displayTickValue(): number {
    return this.displayTick
  }
}
