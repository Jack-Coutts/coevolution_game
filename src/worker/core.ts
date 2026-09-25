import { summarizeEvolution, type EvolutionSample } from '@/sim/evolution'
import { Sim, type Intervention, type MeadowState } from '@/sim/sim'
import { endInfo, frame, writeStats } from './pack'
import {
  STAT_STRIDE,
  type FrameData,
  type FromWorker,
  type ToWorker,
} from './protocol'

/** Wall-clock budget per advance chunk so the worker stays responsive to new messages. */
const CHUNK_MS = 24
/** Checkpoint spacing. The worker runs ahead of the displayed hour, so an intervention rewinds to the newest checkpoint at or before that hour and re-steps from there. */
export const CHECKPOINT_EVERY = 24
/** Enough checkpoints to cover how far the simulation can lead the display at the fastest speed. */
const CHECKPOINTS_KEPT = 24

function statsRow(s: Sim): Float64Array {
  const row = new Float64Array(STAT_STRIDE)
  writeStats(s, row, 0)
  return row
}

export type Post = (msg: FromWorker, transfer: Transferable[]) => void

/** The worker's message handling, kept free of worker globals so tests can drive it directly. */
export class SimCore {
  private sim: Sim | null = null
  private runId = 0
  private checkpoints: MeadowState[] = []
  private readonly post: Post

  constructor(post: Post) {
    this.post = post
  }

  handle(msg: ToWorker): void {
    switch (msg.type) {
      case 'init': {
        this.runId = msg.runId
        this.sim = new Sim(msg.params, msg.seed, msg.disturbance, { record: true })
        this.checkpoints = []
        this.checkpoint()
        const stats = statsRow(this.sim)
        this.post({ type: 'ready', evolution: summarizeEvolution(this.sim), runId: this.runId, cover: this.sim.cover, frame: frame(this.sim), stats }, [stats.buffer])
        break
      }
      case 'save': {
        // Save the hour the player is looking at, not the hours the worker has run ahead (a copy, so the lead stays valid).
        if (this.sim && msg.runId === this.runId) this.post({ type: 'saved', runId: this.runId, state: (this.rewound(msg.at ?? this.sim.tick) ?? this.sim).save() }, [])
        break
      }
      case 'restore': {
        this.runId = msg.runId
        this.sim = Sim.restore(msg.state)
        this.checkpoints = []
        this.checkpoint()
        const stats = statsRow(this.sim)
        this.post({ type: 'ready', restored: true, end: endInfo(this.sim), evolution: summarizeEvolution(this.sim), runId: this.runId,
          cover: this.sim.cover, frame: frame(this.sim), stats }, [stats.buffer])
        break
      }
      case 'advance': {
        const s = this.sim
        if (!s || msg.runId !== this.runId) return
        const frames: FrameData[] = []
        const rows: Float64Array[] = []
        const evolution: EvolutionSample[] = []
        const t0 = performance.now()
        while (!s.ended && s.tick < msg.target && performance.now() - t0 < CHUNK_MS && frames.length < 4000) {
          s.step()
          if (s.tick % 24 === 0 || s.ended) evolution.push(summarizeEvolution(s))
          frames.push(frame(s))
          rows.push(statsRow(s))
          if (s.tick % CHECKPOINT_EVERY === 0) this.checkpoint()
        }
        const stats = new Float64Array(rows.length * STAT_STRIDE)
        rows.forEach((row, i) => stats.set(row, i * STAT_STRIDE))
        this.post({ type: 'frames', evolution, runId: this.runId, frames, stats, head: s.tick, end: endInfo(s) }, [stats.buffer])
        break
      }
      case 'intervene': {
        if (!this.sim || msg.runId !== this.runId) return
        this.intervene(msg.action, msg.at)
        break
      }
      default: {
        const never: never = msg
        throw new Error(`unknown message ${String(never)}`)
      }
    }
  }

  /**
   * Apply an action at the hour the player is looking at. The simulation usually runs a little ahead of the
   * display, so rewind to that hour (from a checkpoint, deterministically), queue the action, and step one hour
   * so its effect shows at once, even while paused. Hours after `at` that were computed but not yet shown are
   * discarded. Same seed, settings and action hours therefore give the same run.
   */
  private intervene(action: Intervention, at: number): void {
    const s = this.rewound(at)
    if (!s) {
      // No checkpoint reaches back that far (e.g. just after a resume): refuse rather than act at a later hour.
      const live = this.sim as Sim
      const stats = statsRow(live)
      this.post({ type: 'intervened', runId: this.runId, action, tick: live.tick, from: live.tick, frame: frame(live), stats, evolution: [], end: endInfo(live) }, [stats.buffer])
      return
    }
    if (s !== this.sim) {
      this.sim = s
      this.checkpoints = this.checkpoints.filter(c => c.tick <= at)
    }
    const from = s.tick
    if (!s.ended) {
      s.queue(action)
      s.step()
      // A later rewind must never restore a state from before this action.
      this.checkpoint()
    }
    const evolution = s.tick % 24 === 0 || s.ended ? [summarizeEvolution(s)] : []
    const stats = statsRow(s)
    this.post({ type: 'intervened', runId: this.runId, action, tick: s.tick, from, frame: frame(s), stats, evolution, end: endInfo(s) }, [stats.buffer])
  }

  /**
   * The simulation at hour `at`, re-stepped from the newest checkpoint at or before it; the live one when `at` is not
   * behind it; null when no checkpoint reaches back that far.
   */
  private rewound(at: number): Sim | null {
    const live = this.sim as Sim
    if (at >= live.tick) return live
    const cp = this.checkpoints.findLast(c => c.tick <= at)
    if (!cp) return null
    const s = Sim.restore(structuredClone(cp))
    while (s.tick < at && s.step()) { /* replay the hours the display has already shown */ }
    return s
  }

  private checkpoint(): void {
    if (!this.sim) return
    this.checkpoints.push(structuredClone(this.sim.save()))
    if (this.checkpoints.length > CHECKPOINTS_KEPT) this.checkpoints.shift()
  }
}
