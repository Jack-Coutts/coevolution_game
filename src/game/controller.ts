import { BUDGET, deriveParams, spent, type LeverValues } from '@/sim/levers'
import type { SimParams } from '@/sim/params'
import { SCENARIO_BY_ID, type Scenario, type ScenarioId } from '@/sim/scenarios'
import type { Intervention } from '@/sim/sim'
import { tickAt } from '@/sim/time'
import { WorldRenderer, type Weather } from '@/render/renderer'
import { STAT_STRIDE, type EndInfo, type FrameData, type FromWorker, type ToWorker } from '@/worker/protocol'
import SimWorker from '@/worker/sim.worker.ts?worker'
import { RunHistory } from './history'
import { explain, hints, type Explanation, type Hint } from './insights'
import { recordScore, scoreFor, scoreRun, type BestScore, type ScoreBreakdown } from './scores'

export type Phase = 'loading' | 'planning' | 'running' | 'ended'

export interface RunConfig {
  levers: LeverValues
  base: LeverValues
  scenario: ScenarioId
  seed: number
}

export const SPEEDS = [
  { label: '12 h/s', tps: 12 },
  { label: '1 d/s', tps: 24 },
  { label: '3 d/s', tps: 72 },
  { label: '1 wk/s', tps: 168 },
  { label: '2 wk/s', tps: 336 },
  { label: '1 mo/s', tps: 720 },
]
export const DEFAULT_SPEED = 3

export const CHARGES = 4
export const COOLDOWN = 400

export interface Snapshot {
  phase: Phase
  playing: boolean
  tick: number
  head: number
  horizon: number
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
  charges: number
  cooldownUntil: number
  atLive: boolean
  interventions: { tick: number; action: Intervention }[]
  runId: number
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
  history: RunHistory = new RunHistory(8000)
  params: SimParams | null = null
  scenario: Scenario = SCENARIO_BY_ID.stable
  config: RunConfig | null = null
  cover: [number, number][] = []
  private worker: Worker
  private renderer: WorldRenderer | null = null
  private runId = 0
  private displayTick = 0
  private playing = false
  private speed = DEFAULT_SPEED
  private phase: Phase = 'loading'
  private end: EndInfo | null = null
  private inflight = false
  private raf = 0
  private last = 0
  private lastFxTick = 0
  private charges = CHARGES
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

  attachCanvas(canvas: HTMLCanvasElement | null): void {
    this.renderer = canvas ? new WorldRenderer(canvas) : null
    if (this.renderer && this.params) this.renderer.setWorld(this.cover, this.params.eco.coverR, this.config?.seed ?? 0, this.params.patchStock)
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
    if (p && this.hintCache.tick !== t) {
      this.hintCache = {
        tick: t,
        hints: hints(h, t, { prey: p.prey.cap, pred: p.pred.cap }),
      }
    }
    return {
      phase: this.phase,
      playing: this.playing,
      tick: t,
      head: h.head,
      horizon: h.horizon,
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
      charges: this.charges,
      cooldownUntil: this.cooldownUntil,
      atLive: this.atLive(),
      interventions: h.interventions,
      runId: this.runId,
    }
  }

  private atLive(): boolean {
    return this.history.head - this.displayTick < Math.max(8, SPEEDS[this.speed].tps * 0.6)
  }

  /** Start a fresh run at tick 0 (planning phase). */
  configure(config: RunConfig): void {
    this.config = config
    this.params = deriveParams(config.levers)
    this.scenario = SCENARIO_BY_ID[config.scenario]
    this.runId += 1
    this.history = new RunHistory(this.params.horizon)
    this.displayTick = 0
    this.lastFxTick = 0
    this.playing = false
    this.phase = 'loading'
    this.end = null
    this.inflight = false
    this.finalized = false
    this.explanation = null
    this.score = null
    this.newBest = false
    this.charges = CHARGES
    this.cooldownUntil = 0
    this.best = scoreFor(config)
    this.renderer?.clearFx()
    this.send({
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
        this.phase = 'planning'
        if (this.renderer && this.params && this.config) {
          this.renderer.setWorld(msg.cover, this.params.eco.coverR, this.config.seed, this.params.patchStock)
        }
        this.notify(true)
        break
      case 'frames':
        this.inflight = false
        msg.frames.forEach((f: FrameData, i: number) => this.history.add(f, msg.stats, i * STAT_STRIDE))
        if (msg.end) this.end = msg.end
        this.notify()
        break
      case 'intervened':
        this.history.interventions = [...this.history.interventions, { tick: msg.tick, action: msg.action }]
        this.notify(true)
        break
      default: {
        const never: never = msg
        throw new Error(`unknown message ${String(never)}`)
      }
    }
  }

  play(): void {
    if (this.phase === 'loading') return
    if (this.phase === 'planning' && this.budgetLeft() < 0) return
    if (this.phase === 'ended' && this.displayTick >= this.history.head) this.displayTick = 0
    if (this.phase === 'planning') this.phase = 'running'
    this.playing = true
    this.last = performance.now()
    this.notify(true)
  }

  pause(): void {
    this.playing = false
    this.notify(true)
  }

  toggle(): void {
    if (this.playing) this.pause()
    else this.play()
  }

  setSpeed(i: number): void {
    this.speed = Math.max(0, Math.min(SPEEDS.length - 1, i))
    this.notify(true)
  }

  /** Jump the view to a tick already simulated (scrub). */
  seek(tick: number): void {
    this.displayTick = Math.max(0, Math.min(this.history.head, tick))
    this.lastFxTick = Math.floor(this.displayTick)
    this.renderer?.clearFx()
    this.notify(true)
  }

  /** Step forward or back by `n` ticks; stepping past the head simulates when running. */
  stepBy(n: number): void {
    this.pause()
    const target = this.displayTick + n
    if (target > this.history.head && !this.end && this.phase !== 'loading') {
      if (this.phase === 'planning') this.phase = 'running'
      this.send({ type: 'advance', runId: this.runId, target: Math.ceil(target) })
      this.inflight = true
    }
    this.seek(Math.round(target))
  }

  canIntervene(): boolean {
    return (
      this.phase === 'running' &&
      !this.end &&
      this.charges > 0 &&
      this.history.head >= this.cooldownUntil &&
      this.atLive()
    )
  }

  intervene(action: Intervention): void {
    if (!this.canIntervene()) return
    this.charges -= 1
    this.cooldownUntil = this.history.head + COOLDOWN
    this.send({ type: 'intervene', runId: this.runId, action })
    this.notify(true)
  }

  budgetLeft(): number {
    if (!this.config) return BUDGET
    return BUDGET - spent(this.config.levers, this.config.base)
  }

  weather(tick: number): Weather {
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
    if (this.playing) {
      this.displayTick += (dt / 1000) * tps
      if (this.displayTick >= h.head) {
        this.displayTick = h.head
        if (this.end && h.head >= this.end.tick) this.finalize()
      }
    }
    if (!this.end && this.phase === 'running' && this.playing && !this.inflight) {
      const lead = Math.max(6, tps * 0.25)
      if (h.head < this.displayTick + lead) {
        this.inflight = true
        this.send({ type: 'advance', runId: this.runId, target: Math.ceil(this.displayTick + lead) })
      }
    }
    const t = Math.floor(this.displayTick)
    if (this.renderer) {
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
