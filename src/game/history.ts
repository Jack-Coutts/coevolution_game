import type { Intervention } from '@/sim/sim'
import { STAT, STAT_STRIDE, type FrameData } from '@/worker/protocol'

/** Keep every tick for recent playback, and every KEY_EVERY-th tick for scrubbing the whole run. */
const RECENT = 360
const KEY_EVERY = 3

export class RunHistory {
  readonly horizon: number
  readonly stats: Float64Array
  head = 0
  interventions: { tick: number; action: Intervention }[] = []
  private frames = new Map<number, FrameData>()

  constructor(horizon: number) {
    this.horizon = horizon
    this.stats = new Float64Array((horizon + 1) * STAT_STRIDE)
  }

  add(frame: FrameData, row: Float64Array, rowOffset: number): void {
    const t = frame.tick
    this.frames.set(t, frame)
    this.stats.set(row.subarray(rowOffset, rowOffset + STAT_STRIDE), t * STAT_STRIDE)
    this.head = Math.max(this.head, t)
    const drop = t - RECENT
    if (drop > 0 && drop % KEY_EVERY !== 0) this.frames.delete(drop)
  }

  stat(tick: number, key: keyof typeof STAT): number {
    const t = Math.max(0, Math.min(this.head, Math.floor(tick)))
    return this.stats[t * STAT_STRIDE + STAT[key]]
  }

  /** Frames bracketing a fractional tick, with the blend factor between them. */
  frameAt(tick: number): { a: FrameData; b: FrameData; alpha: number } | null {
    const t = Math.max(0, Math.min(this.head, tick))
    let lo = Math.floor(t)
    let a = this.frames.get(lo)
    while (!a && lo > 0) a = this.frames.get(--lo)
    if (!a) return null
    let hi = lo + 1
    let b = this.frames.get(hi)
    while (!b && hi < lo + KEY_EVERY + 1 && hi <= this.head) b = this.frames.get(++hi)
    if (!b) return { a, b: a, alpha: 0 }
    return { a, b, alpha: Math.min(1, Math.max(0, (t - lo) / (hi - lo))) }
  }

  frame(tick: number): FrameData | undefined {
    return this.frames.get(tick)
  }
}
