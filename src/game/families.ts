import type { Species } from '@/sim/sim'
import { ANIMAL_STRIDE, type FrameData } from '@/worker/protocol'

/** One founder's family: everyone who shares its lineage id (the founder's own id). */
export interface LineageSummary {
  species: Species
  founder: number
  firstSeen: number
  lastSeen: number
  /** Members at the latest daily count (0 once the family has died out). */
  living: number
  peak: number
  peakTick: number
  minGen: number
  maxGen: number
}

/** Daily counts per family, flattened as [lineage, count, minGen, maxGen, ...]. */
interface DayCount { tick: number; prey: number[]; pred: number[] }

/** Daily family counts kept in full (about a year); older days are folded into the summaries. */
export const FAMILY_DAYS = 366
/** Families kept per species once they have died out and their days have been folded away. */
export const FAMILY_ARCHIVE = 40
const SPECIES = ['prey', 'pred'] as const

function count(frame: FrameData, species: Species): number[] {
  const rows = species === 'prey' ? frame.prey : frame.preds
  const by = new Map<number, [number, number, number]>()
  for (let i = 0; i < rows.length; i += ANIMAL_STRIDE) {
    const lineage = rows[i + 12]
    const gen = rows[i + 9]
    const c = by.get(lineage)
    if (c) { c[0]++; c[1] = Math.min(c[1], gen); c[2] = Math.max(c[2], gen) } else by.set(lineage, [1, gen, gen])
  }
  return [...by].flatMap(([lineage, [n, lo, hi]]) => [lineage, n, lo, hi])
}

function fold(into: Map<number, LineageSummary>, species: Species, day: DayCount): void {
  for (const s of into.values()) s.living = 0
  const row = day[species]
  for (let i = 0; i < row.length; i += 4) {
    const [founder, n, lo, hi] = row.slice(i, i + 4)
    const s = into.get(founder)
    if (!s) { into.set(founder, { species, founder, firstSeen: day.tick, lastSeen: day.tick, living: n, peak: n, peakTick: day.tick, minGen: lo, maxGen: hi }); continue }
    s.lastSeen = day.tick
    s.living = n
    if (n > s.peak) { s.peak = n; s.peakTick = day.tick }
    s.minGen = Math.min(s.minGen, lo)
    s.maxGen = Math.max(s.maxGen, hi)
  }
}

/** A bounded family history computed from daily frames: no genealogy, only per-founder counts and generations. */
export class FamilyHistory {
  days: DayCount[] = []
  /** Summaries of days that no longer have their own counts. */
  private archive: Record<Species, LineageSummary[]> = { prey: [], pred: [] }

  observe(tick: number, frame: FrameData | undefined): void {
    if (!frame || (this.days.at(-1)?.tick ?? -1) >= tick) return
    this.days.push({ tick, prey: count(frame, 'prey'), pred: count(frame, 'pred') })
    if (this.days.length <= FAMILY_DAYS) return
    const old = this.days.shift()!
    for (const s of SPECIES) {
      const into = new Map(this.archive[s].map(l => [l.founder, { ...l }]))
      fold(into, s, old)
      // Keep every family still alive on the folded day, then the most recently seen of the rest.
      this.archive[s] = [...into.values()].sort((a, b) => b.living - a.living || b.lastSeen - a.lastSeen)
        .filter((l, i) => l.living > 0 || i < FAMILY_ARCHIVE)
    }
  }

  truncate(tick: number): void {
    while ((this.days.at(-1)?.tick ?? -1) > tick) this.days.pop()
  }

  /** The earliest day with its own counts; before it, only summaries remain. */
  get countedFrom(): number | null { return this.days[0]?.tick ?? null }

  /** Families of a species as of the latest daily count at or before `tick`: living first (largest first), then most recently seen. */
  summaries(species: Species, tick: number): LineageSummary[] {
    const into = new Map(this.archive[species].map(l => [l.founder, { ...l }]))
    for (const d of this.days) if (d.tick <= tick) fold(into, species, d)
    return [...into.values()].sort((a, b) => b.living - a.living || b.lastSeen - a.lastSeen || a.founder - b.founder)
  }

  save() { return { days: this.days, archive: this.archive } }
  restore(data: ReturnType<FamilyHistory['save']> | undefined): void {
    this.days = structuredClone(data?.days ?? [])
    this.archive = structuredClone(data?.archive ?? { prey: [], pred: [] })
  }
}
