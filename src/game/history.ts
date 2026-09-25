import type { Intervention } from '@/sim/sim'
import type { EvolutionSample, JournalEntry } from '@/sim/evolution'
import { FOOD_WEB, perSpecies, TWO_SPECIES, type Species } from '@/sim/species'
import { ANIMAL_STRIDE, STAT, STAT_STRIDE, type FrameData } from '@/worker/protocol'

export const HISTORY_HOURS = 8760
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
  interventions: { tick: number; action: Intervention }[] = []
  evolution: EvolutionSample[] = []
  journal: JournalEntry[] = []
  private highestGeneration: Record<Species, number> = perSpecies(() => 0)
  private frames = new Map<number, FrameData>()

  constructor(horizon: number, endless = false, species: readonly Species[] = TWO_SPECIES) {
    this.limit = horizon
    this.endless = endless
    this.species = species
  }
  get horizon(): number { return this.endless ? Math.max(this.limit, this.head + 300) : this.limit }
  get firstTick(): number { return Math.max(this.start, this.head - HISTORY_HOURS) }

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
    for (const s of this.species) {
      const name = FOOD_WEB[s].name
      const label = name.charAt(0).toUpperCase() + name.slice(1)
      if (prev && Math.floor(sample[s].generation / 5) > Math.floor(this.highestGeneration[s] / 5))
        this.journal.push({ tick: sample.tick, text: `${label} descendants reached generation ${sample[s].generation}.` })
      this.highestGeneration[s] = Math.max(this.highestGeneration[s], sample[s].generation)
      if (prev && prev[s].lineages > 1 && sample[s].lineages === 1)
        this.journal.push({ tick: sample.tick, text: `One founding ${label.toLowerCase()} lineage remains.` })
    }
    if (prev && this.species.every(s => sample[s].count > 0) && Math.floor(sample.tick / 8760) > Math.floor(prev.tick / 8760))
      this.journal.push({ tick: sample.tick, text: `${this.species.length === 2 ? 'Both' : 'All'} species reached year ${Math.floor(sample.tick / 8760) + 1}.` })
    this.journal = this.journal.slice(-80)
    this.evolution.push(sample)
    // Preserve the founder reference, plus the most recent daily observations.
    if (this.evolution.length > 367) this.evolution.splice(1, this.evolution.length - 367)
  }

  save() {
    return { stats: this.stats, highestGeneration: this.highestGeneration, head: this.head, start: Math.max(this.firstTick, this.head - RECENT),
      frames: [...this.frames.entries()].filter(([t]) => t >= this.head - RECENT),
      /** Floats per animal in `frames`; saves without it used the pre-body-size stride. */
      animalStride: ANIMAL_STRIDE as number | undefined }
  }

  restore(data: ReturnType<RunHistory['save']>): void {
    this.stats.set(data.stats)
    this.highestGeneration = data.highestGeneration
    this.head = data.head
    this.start = data.start
    this.frames = new Map(data.frames)
  }

  stat(tick: number, key: keyof typeof STAT): number {
    const t = Math.max(this.firstTick, Math.min(this.head, Math.floor(tick)))
    return this.stats[(t % CAPACITY) * STAT_STRIDE + STAT[key]]
  }

  frameAt(tick: number): { a: FrameData; b: FrameData; alpha: number } | null {
    const t = Math.max(this.firstTick, Math.min(this.head, tick))
    let lo = Math.floor(t)
    let a = this.frames.get(lo)
    while (!a && lo > this.firstTick) a = this.frames.get(--lo)
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
