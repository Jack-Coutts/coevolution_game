import { TRAITS, type Distribution, type EvolutionSample, type TraitKey } from '@/sim/evolution'
import type { Species } from '@/sim/sim'
import { ANIMAL_STRIDE, type FrameData } from '@/worker/protocol'

/**
 * The evolution journal: observed events, each with the measurement it came from. Entries state what was measured;
 * the `caveat` states what the measurement does not show. No entry explains why something happened.
 */

/** How a player should read an entry: family history, a measured inherited change, or what happened to a population. */
export type JournalCategory = 'family' | 'inherited' | 'outcome'

/** A measured value with its middle-80% band, at a daily sample. */
export interface Measured extends Distribution { tick: number }

interface Base {
  tick: number
  /** The observation, in plain words. */
  text: string
  /** What the observation does not show (optional). */
  caveat?: string
  /** An animal alive at `tick` to inspect, and the founder id of a family to follow. */
  animal?: { species: Species; id: number }
  lineage?: { species: Species; id: number }
}

export type JournalEntry =
  /** Evidence: the highest generation among living animals in the daily sample. Threshold: each new multiple of 5. */
  | Base & { kind: 'generation'; species: Species; evidence: { generation: number; every: number } }
  /** Evidence: distinct founder lineages among living animals in the daily sample. Threshold: falling from more than 1 to 1. */
  | Base & { kind: 'lineage'; species: Species; evidence: { from: number; to: number } }
  /** Evidence: daily trait distributions from Evolution. Threshold: see TRAIT_SHIFT. */
  | Base & { kind: 'traitShift'; species: Species; evidence: TraitShiftEvidence }
  /** Evidence: the living count in consecutive daily samples. Threshold: from above 0 to 0. */
  | Base & { kind: 'extinction'; species: Species; evidence: { lastCount: number; lastGeneration: number; lastSeen: number } }
  /** Evidence: both counts above 0 at the first daily sample of a new year. */
  | Base & { kind: 'year'; evidence: { year: number; prey: number; pred: number } }
  /**
   * Reserved for persistent ecological varieties (issue #11). The detector supplies its own measurement, a threshold in
   * words and a `key` that identifies the variety; `record` keeps one entry per key until `release(key)`.
   */
  | Base & { kind: 'variety'; species: Species; key: string; evidence: VarietyEvidence }
  /** An entry from a save made before entries had kinds. */
  | Base & { kind: 'note' }

export type JournalKind = JournalEntry['kind']

export interface TraitShiftEvidence {
  trait: TraitKey
  direction: 1 | -1
  /** The first daily sample with enough animals: founders, or the first measured arrivals. */
  baseline: Measured
  now: Measured
  /** The first sample of the qualifying run of daily samples. */
  since: number
  samples: number
  /** The fewest living animals in any sample of the run. */
  fewest: number
  threshold: number
}

export interface VarietyEvidence {
  /** What was measured, e.g. a trait combination; and the rule that made it count as persistent. */
  measure: string
  threshold: string
  since: number
  samples: number
  values: Record<string, number>
}

export const CATEGORY: Record<JournalKind, JournalCategory> = {
  generation: 'family', lineage: 'family', traitShift: 'inherited', variety: 'inherited', extinction: 'outcome', year: 'outcome', note: 'family',
}

/**
 * A trait shift is recorded when a species' mean moves at least `threshold` from its baseline and stays there for
 * `samples` consecutive daily samples, each with at least `minCount` animals. It is recorded once per trait and
 * direction, and can be recorded again only after the mean comes back within `release` of the baseline.
 * Samples with fewer animals neither extend a run nor count as a return (small groups make noisy means).
 */
export const TRAIT_SHIFT = { threshold: 0.25, release: 0.125, samples: 20, minCount: 10 } as const
export const JOURNAL_LIMIT = 80
const GENERATION_STEP = 5

export const TRAIT_LABEL: Record<TraitKey, string> = { forage: 'food seeking', flee: 'threat avoidance', cruise: 'cruising pace', hide: 'cover seeking' }
const NAME: Record<Species, [string, string]> = { prey: ['Rabbit', 'Rabbits'], pred: ['Fox', 'Foxes'] }
const day = (tick: number) => Math.floor(tick / 24) + 1
const f2 = (v: number) => v.toFixed(2)

export const TRAIT_CAVEAT = 'Inherited tendency, measured in the same test situations for every animal. This records a change; it does not show why it happened or whether it helps.'
const UNUSED_CAVEAT = ' Nothing hunts foxes here, so they never use this response.'

interface Latch { tick: number; released?: number }
interface Baseline { tick: number; traits: Record<TraitKey, Distribution> }

export interface JournalState {
  entries: JournalEntry[]
  dropped: number
  latches: Record<string, Latch>
  baselines: Partial<Record<Species, Baseline>>
  highest: Record<Species, number>
}

/** Stored entries from saves made before entries had kinds become plain notes. */
export function normalize(entries: readonly (JournalEntry | { tick: number; text: string })[] | undefined): JournalEntry[] {
  return (entries ?? []).map(e => ('kind' in e ? e : { kind: 'note', tick: e.tick, text: e.text }))
}

/** The highest-generation animal in a frame (lowest id on ties); the lineage of the only remaining family. */
function eldest(frame: FrameData | undefined, species: Species): { id: number; lineage: number } | null {
  const rows = species === 'prey' ? frame?.prey : frame?.preds
  if (!rows) return null
  let best = -1
  for (let i = 0; i < rows.length; i += ANIMAL_STRIDE)
    if (best < 0 || rows[i + 9] > rows[best + 9] || (rows[i + 9] === rows[best + 9] && rows[i] < rows[best])) best = i
  return best < 0 ? null : { id: rows[best], lineage: rows[best + 12] }
}

export class Journal {
  entries: JournalEntry[] = []
  /** Entries dropped to keep the journal bounded. */
  dropped = 0
  private latches: Record<string, Latch> = {}
  private baselines: Partial<Record<Species, Baseline>> = {}
  private highest: Record<Species, number> = { prey: 0, pred: 0 }

  private readonly endless: boolean
  constructor(endless = false) { this.endless = endless }

  /** Add an entry, dropping the oldest beyond the limit. */
  private push(entry: JournalEntry): void {
    this.entries.push(entry)
    if (this.entries.length > JOURNAL_LIMIT) {
      this.dropped += this.entries.length - JOURNAL_LIMIT
      this.entries.splice(0, this.entries.length - JOURNAL_LIMIT)
    }
  }

  /**
   * Record a persistent variety once per key (issue #11's detector calls this); returns false for a duplicate.
   * `release(key)` allows the key to be recorded again after the variety is gone.
   */
  record(entry: Extract<JournalEntry, { kind: 'variety' }>): boolean {
    const key = `variety:${entry.key}`
    if (this.latches[key] && this.latches[key].released === undefined) return false
    this.latches[key] = { tick: entry.tick }
    this.push(entry)
    return true
  }
  release(key: string, tick: number): void {
    const latch = this.latches[`variety:${key}`]
    if (latch && latch.released === undefined) latch.released = tick
  }

  /** Observe a new daily sample. `samples` ends with `sample`; `frame` is the frame at the sample's hour, if kept. */
  observe(samples: readonly EvolutionSample[], frame: FrameData | undefined): void {
    const sample = samples.at(-1)
    if (!sample) return
    const prev = samples.at(-2)
    for (const s of ['prey', 'pred'] as const) {
      const [one, many] = NAME[s]
      const now = sample[s]
      if (prev && Math.floor(now.generation / GENERATION_STEP) > Math.floor(this.highest[s] / GENERATION_STEP)) {
        const who = eldest(frame, s)
        this.push({ kind: 'generation', species: s, tick: sample.tick, text: `${one} descendants reached generation ${now.generation}.`,
          evidence: { generation: now.generation, every: GENERATION_STEP },
          ...(who && { animal: { species: s, id: who.id }, lineage: { species: s, id: who.lineage } }) })
      }
      this.highest[s] = Math.max(this.highest[s], now.generation)
      if (prev && prev[s].lineages > 1 && now.lineages === 1) {
        const who = eldest(frame, s)
        this.push({ kind: 'lineage', species: s, tick: sample.tick, text: `One founding ${one.toLowerCase()} lineage remains${who ? `: family #${who.lineage}` : ''}.`,
          caveat: 'Every living animal descends from this founder. That alone does not show its genes were better; small families are also lost by chance.',
          evidence: { from: prev[s].lineages, to: 1 }, ...(who && { lineage: { species: s, id: who.lineage } }) })
      }
      if (prev && prev[s].count > 0 && now.count === 0)
        this.push({ kind: 'extinction', species: s, tick: sample.tick, text: `${many} died out. The last ones were generation ${prev[s].generation}.`,
          evidence: { lastCount: prev[s].count, lastGeneration: prev[s].generation, lastSeen: prev.tick } })
      this.traitShifts(samples, s)
    }
    if (prev && sample.prey.count > 0 && sample.pred.count > 0 && Math.floor(sample.tick / 8760) > Math.floor(prev.tick / 8760)) {
      const year = Math.floor(sample.tick / 8760) + 1
      this.push({ kind: 'year', tick: sample.tick, text: this.endless ? `Both species reached year ${year}.` : 'Both species lasted the full year.',
        evidence: { year, prey: sample.prey.count, pred: sample.pred.count } })
    }
  }

  private traitShifts(samples: readonly EvolutionSample[], s: Species): void {
    const sample = samples.at(-1)!
    const { threshold, release, minCount } = TRAIT_SHIFT
    if (sample[s].count < minCount) return
    // Founders, or for a species that arrives later (or a resumed older save) the first retained sample with enough animals.
    const first = samples.find(e => e[s].count >= minCount)!
    const base = this.baselines[s] ??= { tick: first.tick, traits: structuredClone(first[s].traits) }
    for (const trait of TRAITS) {
      const b = base.traits[trait]
      for (const direction of [1, -1] as const) {
        const key = `${s}:${trait}:${direction}`
        const latch = this.latches[key]
        const offset = direction * (sample[s].traits[trait].mean - b.mean)
        if (latch && latch.released === undefined) {
          if (offset < release) latch.released = sample.tick
          continue
        }
        // Walk back over the unbroken run of qualifying samples.
        let run = 0
        let fewest = Infinity
        for (let i = samples.length - 1; i >= 0 && run < TRAIT_SHIFT.samples; i--) {
          const p = samples[i][s]
          if (p.count < minCount || direction * (p.traits[trait].mean - b.mean) < threshold || samples[i].tick < base.tick) break
          run++
          fewest = Math.min(fewest, p.count)
        }
        if (run < TRAIT_SHIFT.samples) continue
        const since = samples[samples.length - run].tick
        const now = sample[s].traits[trait]
        const [one] = NAME[s]
        const label = TRAIT_LABEL[trait]
        this.latches[key] = { tick: sample.tick }
        this.push({ kind: 'traitShift', species: s, tick: sample.tick,
          text: `${one} ${label} has ${direction > 0 ? 'risen' : 'fallen'} from ${f2(b.mean)} ${base.tick === 0 ? 'among the founders' : `on day ${day(base.tick)}`} to ${f2(now.mean)}, `
            + `staying at least ${threshold} ${direction > 0 ? 'higher' : 'lower'} for ${run} daily samples in a row (since day ${day(since)}).`,
          caveat: TRAIT_CAVEAT + (s === 'pred' && trait === 'flee' ? UNUSED_CAVEAT : ''),
          evidence: { trait, direction, baseline: { tick: base.tick, ...b }, now: { tick: sample.tick, ...now }, since, samples: run, fewest, threshold } })
      }
    }
  }

  /** Forget what was observed after `tick` (an intervention rewound the worker). */
  truncate(tick: number, samples: readonly EvolutionSample[]): void {
    this.entries = this.entries.filter(e => e.tick <= tick)
    for (const [key, latch] of Object.entries(this.latches)) {
      if (latch.tick > tick) delete this.latches[key]
      else if (latch.released !== undefined && latch.released > tick) latch.released = undefined
    }
    for (const s of ['prey', 'pred'] as const) {
      if ((this.baselines[s]?.tick ?? -1) > tick) delete this.baselines[s]
      this.highest[s] = Math.max(0, ...samples.map(e => e[s].generation))
    }
  }

  save(): JournalState {
    return { entries: this.entries, dropped: this.dropped, latches: this.latches, baselines: this.baselines, highest: this.highest }
  }

  /** Restore a saved journal. Older saves stored only the entries (and the generation high-water mark). */
  restore(state: Partial<JournalState> & { entries?: JournalState['entries'] }, highest?: Record<Species, number>): void {
    this.entries = normalize(state.entries)
    this.dropped = state.dropped ?? 0
    this.latches = structuredClone(state.latches ?? {})
    this.baselines = structuredClone(state.baselines ?? {})
    this.highest = { ...(state.highest ?? highest ?? { prey: 0, pred: 0 }) }
  }
}
