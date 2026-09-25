import type { Intervention } from '@/sim/sim'
import type { EvolutionSample, JournalEntry } from '@/sim/evolution'
import { STAT, STAT_STRIDE, type FrameData } from '@/worker/protocol'

export const HISTORY_HOURS = 8760
const CAPACITY = HISTORY_HOURS + 1
const RECENT = 360
const KEY_EVERY = 3

/** A rolling year of statistics and replay. Memory does not grow with an Endless run. */
export class RunHistory {
  readonly limit: number
  readonly endless: boolean
  readonly stats = new Float64Array(CAPACITY * STAT_STRIDE)
  head = 0
  start = 0
  /** A resumed run keeps its whole graph but only the recent replay; frames exist from here on. */
  replayFrom = 0
  interventions: { tick: number; action: Intervention }[] = []
  evolution: EvolutionSample[] = []
  journal: JournalEntry[] = []
  private highestGeneration = { prey: 0, pred: 0 }
  private frames = new Map<number, FrameData>()

  constructor(horizon: number, endless = false) { this.limit = horizon; this.endless = endless }
  get horizon(): number { return this.endless ? Math.max(this.limit, this.head + 300) : this.limit }
  get firstTick(): number { return Math.max(this.start, this.head - HISTORY_HOURS) }
  /** The earliest hour the meadow can be replayed at. */
  get replayStart(): number { return Math.max(this.firstTick, this.replayFrom) }

  add(frame: FrameData, row: Float64Array, rowOffset: number): void {
    const t = frame.tick
    if (this.frames.size === 0) this.start = t
    this.frames.set(t, frame)
    this.stats.set(row.subarray(rowOffset, rowOffset + STAT_STRIDE), (t % CAPACITY) * STAT_STRIDE)
    this.head = Math.max(this.head, t)
    const drop = t - RECENT
    if (drop > this.start && drop % KEY_EVERY !== 0) this.frames.delete(drop)
    this.frames.delete(t - HISTORY_HOURS - 1)
  }

  addEvolution(sample: EvolutionSample): void {
    const prev = this.evolution.at(-1)
    if (prev?.tick === sample.tick) return
    for (const s of ['prey', 'pred'] as const) {
      const label = s === 'prey' ? 'Rabbit' : 'Fox'
      if (prev && Math.floor(sample[s].generation / 5) > Math.floor(this.highestGeneration[s] / 5))
        this.journal.push({ tick: sample.tick, text: `${label} descendants reached generation ${sample[s].generation}.` })
      this.highestGeneration[s] = Math.max(this.highestGeneration[s], sample[s].generation)
      if (prev && prev[s].lineages > 1 && sample[s].lineages === 1)
        this.journal.push({ tick: sample.tick, text: `One founding ${label.toLowerCase()} lineage remains.` })
      if (prev && prev[s].count > 0 && sample[s].count === 0)
        this.journal.push({ tick: sample.tick, text: `${label === 'Rabbit' ? 'Rabbits' : 'Foxes'} died out. The last ones were generation ${prev[s].generation}.` })
    }
    if (prev && sample.prey.count > 0 && sample.pred.count > 0 && Math.floor(sample.tick / 8760) > Math.floor(prev.tick / 8760))
      this.journal.push({ tick: sample.tick, text: this.endless ? `Both species reached year ${Math.floor(sample.tick / 8760) + 1}.` : 'Both species lasted the full year.' })
    this.journal = this.journal.slice(-80)
    this.evolution.push(sample)
    // Preserve the founder reference, plus the most recent daily observations.
    if (this.evolution.length > 367) this.evolution.splice(1, this.evolution.length - 367)
  }

  /** Forget everything after `tick`: the worker recomputed those hours (an intervention at `tick`). */
  truncate(tick: number): void {
    if (tick >= this.head) return
    for (const t of [...this.frames.keys()]) if (t > tick) this.frames.delete(t)
    this.head = Math.max(this.start, tick)
    while (this.evolution.length > 1 && (this.evolution.at(-1)?.tick ?? 0) > tick) this.evolution.pop()
    this.journal = this.journal.filter(e => e.tick <= tick)
    for (const s of ['prey', 'pred'] as const) this.highestGeneration[s] = Math.max(0, ...this.evolution.map(e => e[s].generation))
  }

  save() {
    const replayFrom = Math.max(this.replayStart, this.head - RECENT)
    return { stats: this.stats, highestGeneration: this.highestGeneration, head: this.head, start: this.firstTick, replayFrom,
      frames: [...this.frames.entries()].filter(([t]) => t >= replayFrom) }
  }

  restore(data: ReturnType<RunHistory['save']>): void {
    this.stats.set(data.stats)
    this.highestGeneration = data.highestGeneration
    this.head = data.head
    this.start = data.start
    // Saves made before replayFrom existed stored the replay start as `start`.
    this.replayFrom = data.replayFrom ?? data.start
    this.frames = new Map(data.frames)
  }

  stat(tick: number, key: keyof typeof STAT): number {
    const t = Math.max(this.firstTick, Math.min(this.head, Math.floor(tick)))
    return this.stats[(t % CAPACITY) * STAT_STRIDE + STAT[key]]
  }

  frameAt(tick: number): { a: FrameData; b: FrameData; alpha: number } | null {
    const first = this.replayStart
    const t = Math.max(first, Math.min(this.head, tick))
    let lo = Math.floor(t)
    let a = this.frames.get(lo)
    while (!a && lo > first) a = this.frames.get(--lo)
    if (!a) {
      lo = Math.ceil(t)
      while (!a && lo <= this.head && lo < t + KEY_EVERY + 1) a = this.frames.get(lo++)
      if (!a) return null
      lo = a.tick
    }
    let hi = lo + 1
    let b = this.frames.get(hi)
    while (!b && hi < lo + KEY_EVERY + 1 && hi <= this.head) b = this.frames.get(++hi)
    if (!b) return { a, b: a, alpha: 0 }
    return { a, b, alpha: Math.min(1, Math.max(0, (t - lo) / (hi - lo))) }
  }
  frame(tick: number): FrameData | undefined { return this.frames.get(tick) }
}
