import type { Intervention } from '@/sim/sim'
import type { EvolutionSample } from '@/sim/evolution'
import { TWO_SPECIES, type Species } from '@/sim/species'
import { framePop } from './species-ui'
import { FamilyHistory } from './families'
import { Journal, type JournalEntry } from './journal'
import { VarietyTracker } from './varieties'
import { ANIMAL_STRIDE, STAT, STAT_STRIDE, type FrameData } from '@/worker/protocol'

export interface Sighting { tick: number; row: Float32Array }

export const HISTORY_HOURS = 8760
/** A column of the statistics row. */
export type StatKey = keyof typeof STAT
const CAPACITY = HISTORY_HOURS + 1
const RECENT = 360
const KEY_EVERY = 3

/** A rolling year of statistics and replay. Memory does not grow with an Endless run. */
export class RunHistory {
  readonly limit: number
  readonly endless: boolean
  /** The species in this meadow. */
  readonly species: readonly Species[]
  readonly stats = new Float64Array(CAPACITY * STAT_STRIDE)
  head = 0
  start = 0
  /** A resumed run keeps its whole graph but only the recent replay; frames exist from here on. */
  replayFrom = 0
  interventions: { tick: number; action: Intervention }[] = []
  evolution: EvolutionSample[] = []
  readonly log: Journal
  readonly families: FamilyHistory
  readonly varieties: VarietyTracker
  private frames = new Map<number, FrameData>()
  /** lastSeen answers by animal, valid until a rewind or restore. */
  private seen = new Map<string, { before: number; result: Sighting | null }>()

  constructor(horizon: number, endless = false, species: readonly Species[] = TWO_SPECIES) {
    this.limit = horizon
    this.endless = endless
    this.species = species
    this.log = new Journal(endless, species)
    this.families = new FamilyHistory(species)
    this.varieties = new VarietyTracker(species)
  }
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

  /**
   * Add a sample for the charts. The journal and family counts observe only daily samples, plus the run's final
   * sample (`final`, which may fall mid-day), so a resume at its own hour does not add an extra day.
   */
  addEvolution(sample: EvolutionSample, final = false): void {
    const prev = this.evolution.at(-1)
    if (prev?.tick === sample.tick) return
    this.evolution.push(sample)
    if (sample.tick % 24 === 0 || final) {
      // The frame at the sample's hour has just arrived with it.
      const frame = this.frames.get(sample.tick)
      this.log.observe(this.evolution, frame)
      this.families.observe(sample.tick, frame)
      this.varieties.observe(sample.tick, frame, this.log)
    }
    // Preserve the founder reference, plus the most recent daily observations.
    if (this.evolution.length > 367) this.evolution.splice(1, this.evolution.length - 367)
  }

  /** Forget everything after `tick`: the worker recomputed those hours (an intervention at `tick`). */
  truncate(tick: number): void {
    if (tick >= this.head) return
    // The stats ring still holds the discarded hours' values in its oldest slots, so keep the window from moving back.
    this.start = Math.max(this.start, this.head - HISTORY_HOURS)
    for (const t of [...this.frames.keys()]) if (t > tick) this.frames.delete(t)
    this.seen.clear()
    this.head = Math.max(this.start, tick)
    while (this.evolution.length > 1 && (this.evolution.at(-1)?.tick ?? 0) > tick) this.evolution.pop()
    this.log.truncate(tick, this.evolution)
    this.families.truncate(tick)
    this.varieties.truncate(tick)
  }

  /** Everything up to `upTo`: a save holds the world at that hour, so later hours would be replayed twice. */
  save(upTo = this.head) {
    const head = Math.min(this.head, upTo)
    const replayFrom = Math.max(this.replayStart, head - RECENT)
    const log = new Journal(this.endless, this.species)
    log.restore(this.log.save())
    const families = new FamilyHistory(this.species)
    families.restore(this.families.save())
    const varieties = new VarietyTracker(this.species)
    varieties.restore(this.varieties.save())
    if (head < this.head) {
      log.truncate(head, this.evolution.filter(e => e.tick <= head))
      families.truncate(head)
      varieties.truncate(head)
    }
    const journal = log.save()
    return { stats: this.stats, head, start: this.firstTick, replayFrom,
      journal: journal as ReturnType<Journal['save']> | undefined, families: families.save() as ReturnType<FamilyHistory['save']> | undefined,
      varieties: varieties.save() as ReturnType<VarietyTracker['save']> | undefined,
      /** For older builds; this build reads `journal.highest`. */
      highestGeneration: journal.highest as Record<Species, number> | undefined,
      frames: [...this.frames.entries()].filter(([t]) => t >= replayFrom && t <= head) }
  }

  /** `entries` are the journal entries stored beside the history by saves made before the journal state moved here. */
  restore(data: ReturnType<RunHistory['save']>, entries?: readonly (JournalEntry | { tick: number; text: string })[]): void {
    this.stats.set(data.stats)
    this.log.restore(data.journal ?? { entries: entries as JournalEntry[] | undefined }, data.highestGeneration)
    this.families.restore(data.families)
    this.varieties.restore(data.varieties)
    this.head = data.head
    this.start = data.start
    // Saves made before replayFrom existed stored the replay start as `start`.
    this.replayFrom = data.replayFrom ?? data.start
    this.frames = new Map(data.frames)
    this.seen.clear()
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

  /**
   * The last kept hour at or before `before` when an animal was alive, with its frame row; null if the kept replay never
   * shows it. Answers are cached per animal: asked again for a later hour, only the hours since are read.
   */
  lastSeen(species: Species, id: number, before: number): Sighting | null {
    const find = (tick: number) => {
      const f = this.frames.get(tick)
      const rows = f && framePop(f, species)
      if (rows) for (let i = 0; i < rows.length; i += ANIMAL_STRIDE) if (rows[i] === id) return rows.subarray(i, i + ANIMAL_STRIDE)
      return f ? null : undefined
    }
    const end = Math.min(this.head, Math.floor(before))
    const key = `${species}:${id}`
    const cached = this.seen.get(key)
    let result: Sighting | null
    if (cached && cached.before <= end) {
      result = cached.result
      for (let t = end; t > cached.before; t--) {
        const row = find(t)
        if (row) { result = { tick: t, row }; break }
      }
    } else result = this.scan(find, end)
    this.seen.delete(key)
    this.seen.set(key, { before: end, result })
    if (this.seen.size > 64) this.seen.delete(this.seen.keys().next().value!)
    return result
  }

  private scan(find: (tick: number) => Float32Array | null | undefined, end: number): Sighting | null {
    // Every third hour is always kept; scan those back (from the end hour itself), then refine forward hour by hour.
    for (let k = end; k >= this.replayStart - KEY_EVERY; k = k === end ? Math.ceil(end / KEY_EVERY) * KEY_EVERY - KEY_EVERY : k - KEY_EVERY) {
      const at = Math.max(k, this.replayStart)
      const row = find(at)
      if (!row) continue
      let best = { tick: at, row }
      for (let t = at + 1; t <= Math.min(end, at + KEY_EVERY - 1); t++) {
        const r = find(t)
        if (r === null) break
        if (r) best = { tick: t, row: r }
      }
      return best
    }
    return null
  }
}
