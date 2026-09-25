import type { Intervention } from '@/sim/sim'
import type { EvolutionSample } from '@/sim/evolution'
import { FamilyHistory } from './families'
import { Journal, type JournalEntry } from './journal'
import { ANIMAL_STRIDE, STAT, STAT_STRIDE, type FrameData } from '@/worker/protocol'

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
  readonly log: Journal
  readonly families = new FamilyHistory()
  private frames = new Map<number, FrameData>()

  constructor(horizon: number, endless = false) { this.limit = horizon; this.endless = endless; this.log = new Journal(endless) }
  get journal(): JournalEntry[] { return this.log.entries }
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
    this.evolution.push(sample)
    // The frame at the sample's hour has just arrived with it.
    const frame = this.frames.get(sample.tick)
    this.log.observe(this.evolution, frame)
    this.families.observe(sample.tick, frame)
    // Preserve the founder reference, plus the most recent daily observations.
    if (this.evolution.length > 367) this.evolution.splice(1, this.evolution.length - 367)
  }

  /** Forget everything after `tick`: the worker recomputed those hours (an intervention at `tick`). */
  truncate(tick: number): void {
    if (tick >= this.head) return
    for (const t of [...this.frames.keys()]) if (t > tick) this.frames.delete(t)
    this.head = Math.max(this.start, tick)
    while (this.evolution.length > 1 && (this.evolution.at(-1)?.tick ?? 0) > tick) this.evolution.pop()
    this.log.truncate(tick, this.evolution)
    this.families.truncate(tick)
  }

  save() {
    const replayFrom = Math.max(this.replayStart, this.head - RECENT)
    return { stats: this.stats, head: this.head, start: this.firstTick, replayFrom,
      journal: this.log.save() as ReturnType<Journal['save']> | undefined, families: this.families.save() as ReturnType<FamilyHistory['save']> | undefined,
      /** For older builds; this build reads `journal.highest`. */
      highestGeneration: this.log.save().highest as { prey: number; pred: number } | undefined,
      frames: [...this.frames.entries()].filter(([t]) => t >= replayFrom) }
  }

  /** `entries` are the journal entries stored beside the history by saves made before the journal state moved here. */
  restore(data: ReturnType<RunHistory['save']>, entries?: readonly (JournalEntry | { tick: number; text: string })[]): void {
    this.stats.set(data.stats)
    this.log.restore(data.journal ?? { entries: entries as JournalEntry[] | undefined }, data.highestGeneration)
    this.families.restore(data.families)
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

  /** The last kept hour at or before `before` when an animal was alive, with its frame row; null if the kept replay never shows it. */
  lastSeen(species: 'prey' | 'pred', id: number, before: number): { tick: number; row: Float32Array } | null {
    const find = (tick: number) => {
      const f = this.frames.get(tick)
      const rows = species === 'prey' ? f?.prey : f?.preds
      if (rows) for (let i = 0; i < rows.length; i += ANIMAL_STRIDE) if (rows[i] === id) return rows.subarray(i, i + ANIMAL_STRIDE)
      return f ? null : undefined
    }
    const end = Math.min(this.head, Math.floor(before))
    // Daily frames are always kept; scan them back, then refine forward hour by hour within the day found.
    for (let d = Math.floor(end / 24) * 24; d >= this.replayStart - 24; d -= 24) {
      const day = Math.max(d, this.replayStart)
      const row = find(day)
      if (!row) continue
      let best = { tick: day, row }
      for (let t = day + 1; t <= Math.min(end, day + 23); t++) {
        const r = find(t)
        if (r === null) break
        if (r) best = { tick: t, row: r }
      }
      return best
    }
    return null
  }
}
