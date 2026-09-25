import { TRAITS, type TraitKey } from '@/sim/evolution'
import { TWO_SPECIES, type Species } from '@/sim/species'
import { ANIMAL_STRIDE, type FrameData } from '@/worker/protocol'
import type { Journal } from './journal'
import { framePop } from './species-ui'

/**
 * Observed ecological varieties (issue #11): groups of animals within one species whose inherited behaviour differs,
 * found once a day and given an identity only after the difference has lasted. They are measured groupings of
 * behaviour, not subspecies, and are separate from founder families (ancestry).
 *
 * Method, per species and daily sample with at least `minCount` animals:
 * 1. Each animal is a point of its inherited traits (DIMS), each divided by a fixed scale. The four behaviour traits
 *    share one response scale (scale 1). They are deliberately not standardized by the day's spread: that would shrink
 *    the trait that separates two groups and inflate traits that barely vary, hiding clear groups in noise.
 * 2. Deterministic 2-means (k = 2 only): start from the animal farthest from the mean and the animal farthest from it.
 * 3. The split counts when the gap between the two groups is clear: projected onto the line between the centroids,
 *    the middle third holds under half as many animals as the band around the smaller group's centroid
 *    (separation > `minSeparation`), the smaller group has at least `minShare`, and the centroids are at least
 *    `minDistance` apart in trait units.
 * 4. A split becomes a persistent pair of varieties after `persistDays` consecutive daily samples of matching splits
 *    whose population mean generation has risen by at least `persistGenerations` (the difference is passed on across
 *    generations, not held by one cohort). Groups are matched day to day by nearest centroid; each must lie within
 *    `matchTolerance` of the previous distance between the centroids, otherwise it is a different split.
 * 5. The pair is released after `releaseDays` consecutive daily samples without a matching split (the groups merged,
 *    one group was lost, or the difference changed), or at once if the species dies out. Samples with too few animals
 *    neither extend nor end a pair, and break a candidate run.
 * Limits: k = 2 only (a third group, or a variety splitting again, is not detected); a gradual cline without a gap is
 * not a split; only inherited behaviour is used, not what animals actually do.
 */
export const VARIETY = {
  minCount: 20, minShare: 0.15, minSeparation: 0.5, minDistance: 0.2,
  persistDays: 20, persistGenerations: 2, matchTolerance: 0.5, releaseDays: 10,
  /** At most this many animals are clustered per sample (an even stride through the population). */
  maxAnimals: 400,
  /** Daily records kept for display (about a year); state does not depend on them. */
  days: 366,
} as const

/**
 * The inherited traits clustered: frame column and the scale that makes one unit comparable to the behaviour traits'
 * response scale. Another inherited dimension is one more entry; stored centroids then gain a column, so a save from
 * before the change has its varieties reset.
 */
export type DimKey = TraitKey
export const DIMS: readonly { key: DimKey; col: number; scale: number }[] = TRAITS.map((key, i) => ({ key, col: 17 + i, scale: 1 }))

export interface Split {
  /** Whether the split met the thresholds on this day. */
  ok: boolean
  /** Share of each group, largest first. */
  share: [number, number]
  /** Group centroids in scaled units (trait units for behaviour), same order as `share`. */
  c: [number[], number[]]
  /** Distance between the centroids in scaled units, and the gap score. */
  dist: number
  sep: number
}

/** 2-means on rows of trait values; null when there are too few animals to split. */
export function detectSplit(points: readonly number[][]): Split | null {
  const n = points.length
  const d = points[0]?.length ?? 0
  if (n < 4 || d === 0) return null
  const mean = Array<number>(d).fill(0)
  for (const p of points) for (let j = 0; j < d; j++) mean[j] += p[j] / n
  const z = points.map(p => p.map((v, j) => v - mean[j]))
  const dist2 = (a: readonly number[], b: readonly number[]) => { let s = 0; for (let j = 0; j < d; j++) s += (a[j] - b[j]) ** 2; return s }
  const farthest = (from: readonly number[]) => z.reduce((best, p, i) => (dist2(p, from) > dist2(z[best], from) ? i : best), 0)
  // Lloyd's iterations from a start, returning the assignment and its within-group sum of squares.
  const lloyd = (start: number[][]) => {
    let cents = start
    const assign = new Uint8Array(n)
    for (let iter = 0; iter < 50; iter++) {
      let changed = iter === 0
      for (let i = 0; i < n; i++) {
        const g = dist2(z[i], cents[1]) < dist2(z[i], cents[0]) ? 1 : 0
        if (g !== assign[i]) { assign[i] = g; changed = true }
      }
      const next = [Array<number>(d).fill(0), Array<number>(d).fill(0)]
      const counts = [0, 0]
      for (let i = 0; i < n; i++) { counts[assign[i]]++; for (let j = 0; j < d; j++) next[assign[i]][j] += z[i][j] }
      if (counts[0] === 0 || counts[1] === 0) return null
      cents = next.map((c, g) => c.map(v => v / counts[g]))
      if (!changed) break
    }
    return { cents, assign, sse: z.reduce((a, p, i) => a + dist2(p, cents[assign[i]]), 0) }
  }
  // Deterministic starts: the animal farthest from the mean and the animal farthest from it; and, per trait, the
  // centroids of the animals below and above the mean. The start ending with the smallest within-group spread wins.
  const halves = (j: number) => [0, 1].map(side => {
    const members = z.filter(p => (p[j] > 0 ? 1 : 0) === side)
    return members.length ? Array.from({ length: d }, (_, k) => members.reduce((a, p) => a + p[k], 0) / members.length) : null
  })
  const a0 = farthest(Array<number>(d).fill(0))
  const starts = [[z[a0].slice(), z[farthest(z[a0])].slice()], ...Array.from({ length: d }, (_, j) => halves(j))]
  let best: ReturnType<typeof lloyd> = null
  for (const start of starts) {
    if (start.some(c => !c)) continue
    const r = lloyd(start as number[][])
    if (r && (!best || r.sse < best.sse - 1e-9)) best = r
  }
  if (!best) return { ok: false, share: [1, 0], c: [mean, mean], dist: 0, sep: 0 }
  const { cents, assign } = best
  const counts = [0, 0]
  for (let i = 0; i < n; i++) counts[assign[i]]++
  // Gap score: animals near the midpoint versus near the smaller group's centroid, along the line between the centroids.
  const axis = cents[1].map((v, j) => v - cents[0][j])
  const len2 = axis.reduce((a, v) => a + v * v, 0)
  const bands = [0, 0, 0]
  for (const p of z) {
    const t = p.reduce((a, v, j) => a + (v - cents[0][j]) * axis[j], 0) / len2
    for (const [b, at] of [0, 0.5, 1].entries()) if (Math.abs(t - at) < 1 / 6) bands[b]++
  }
  const small = counts[0] <= counts[1] ? 0 : 1
  const peak = bands[small === 0 ? 0 : 2]
  const sep = peak > 0 ? 1 - bands[1] / peak : 0
  const raw = cents.map(c => c.map((v, j) => mean[j] + v))
  const dist = Math.sqrt(dist2(raw[0], raw[1]))
  const big = 1 - small
  const share: [number, number] = [counts[big] / n, counts[small] / n]
  const ok = share[1] >= VARIETY.minShare && sep > VARIETY.minSeparation && dist >= VARIETY.minDistance
  return { ok, share, c: [raw[big], raw[small]], dist, sep }
}

/** Which of the previous centroids each new group matches (`swap` = group 0 matches previous 1), or null for a different split. */
export function matchGroups(prev: readonly number[][], next: readonly number[][]): { swap: boolean } | null {
  const d = (a: readonly number[], b: readonly number[]) => Math.sqrt(a.reduce((s, v, j) => s + (v - b[j]) ** 2, 0))
  const straight = d(prev[0], next[0]) + d(prev[1], next[1])
  const crossed = d(prev[0], next[1]) + d(prev[1], next[0])
  const swap = crossed < straight
  const limit = VARIETY.matchTolerance * d(prev[0], prev[1])
  const ok = swap ? d(prev[0], next[1]) <= limit && d(prev[1], next[0]) <= limit : d(prev[0], next[0]) <= limit && d(prev[1], next[1]) <= limit
  return ok ? { swap } : null
}

interface Candidate { since: number; sinceGen: number; samples: number; c: number[][] }
/** A persistent pair: `ids[i]` names the group with centroid `c[i]`. */
interface Active { ids: [number, number]; since: number; confirmed: number; sinceGen: number; c: number[][]; missing: number; lastSeen: number; last: Split }
interface SpeciesState { candidate: Candidate | null; active: Active | null; next: number }
export interface VarietyState { species: Partial<Record<Species, SpeciesState>> }

/** One species on one daily sample, kept for display and the inspector. */
export interface VarietyDay {
  tick: number
  count: number
  /** The day's split (details only while it met the thresholds), the variety ids of its groups, and candidate progress. */
  split?: Split | { ok: false; share: [number, number]; dist: number; sep: number }
  ids?: [number, number]
  candidate?: { since: number; samples: number; generations: number }
  since?: number
}
export type VarietyDays = { tick: number } & Partial<Record<Species, VarietyDay>>

const NAME: Record<Species, [string, string]> = { prey: ['Rabbit', 'rabbits'], pred: ['Fox', 'foxes'], vole: ['Vole', 'voles'] }
const LABEL: Record<TraitKey, string> = { forage: 'food seeking', flee: 'threat avoidance', cruise: 'cruising pace', hide: 'cover seeking' }
const day = (tick: number) => Math.floor(tick / 24) + 1
const pct = (v: number) => `${Math.round(v * 100)}%`
const r3 = (v: number) => Math.round(v * 1000) / 1000
const round = (s: Split): Split => ({ ...s, share: [r3(s.share[0]), r3(s.share[1])], c: [s.c[0].map(r3), s.c[1].map(r3)], dist: r3(s.dist), sep: r3(s.sep) })

export const VARIETY_CAVEAT = 'Observed ecological varieties: groups found by clustering the four inherited behaviour traits once a day. '
  + 'They are not subspecies and are separate from founder families; they can merge back or vanish, and this does not show why they differ.'

/** The trait whose centroids differ most in units of its spread, described for a sentence. */
export function mainDifference(s: Pick<Split, 'c'>): { trait: DimKey; a: number; b: number } {
  let best = 0
  DIMS.forEach((_, j) => { if (Math.abs(s.c[0][j] - s.c[1][j]) > Math.abs(s.c[0][best] - s.c[1][best])) best = j })
  return { trait: DIMS[best].key, a: s.c[0][best] * DIMS[best].scale, b: s.c[1][best] * DIMS[best].scale }
}
export const traitLabel = (t: TraitKey) => LABEL[t]

/** Bounded daily variety tracking. State is a few numbers per species; `days` keeps about a year for display. */
export class VarietyTracker {
  days: VarietyDays[] = []
  private state: VarietyState = { species: {} }
  /** State before each of the last few daily samples, so a rewind of a few hours can undo them. */
  private undo: { tick: number; state: VarietyState }[] = []
  private readonly species: readonly Species[]
  constructor(species: readonly Species[] = TWO_SPECIES) { this.species = species }

  observe(tick: number, frame: FrameData | undefined, log: Journal): void {
    if (!frame || (this.days.at(-1)?.tick ?? -1) >= tick) return
    this.undo.push({ tick, state: structuredClone(this.state) })
    if (this.undo.length > 8) this.undo.shift()
    const record: VarietyDays = { tick }
    for (const s of this.species) record[s] = this.observeSpecies(s, tick, framePop(frame, s), log)
    this.days.push(record)
    if (this.days.length > VARIETY.days) this.days.splice(0, this.days.length - VARIETY.days)
  }

  private observeSpecies(s: Species, tick: number, rows: Float32Array, log: Journal): VarietyDay {
    const st = this.state.species[s] ??= { candidate: null, active: null, next: 1 }
    const n = rows.length / ANIMAL_STRIDE
    const out: VarietyDay = { tick, count: n }
    if (n === 0 && st.active) this.end(s, st, tick, log, 'died out')
    let gen = 0
    for (let k = 0; k < n; k++) gen += rows[k * ANIMAL_STRIDE + 9] / n
    if (n < VARIETY.minCount) { st.candidate = null; return this.finish(st, out, gen) }
    const step = Math.max(1, n / VARIETY.maxAnimals)
    const points: number[][] = []
    for (let k = 0; k < n && points.length < VARIETY.maxAnimals; k += step) {
      const o = Math.floor(k) * ANIMAL_STRIDE
      points.push(DIMS.map(dim => rows[o + dim.col] / dim.scale))
    }
    const split = detectSplit(points)
    if (!split) { st.candidate = null; return this.finish(st, out, gen) }
    out.split = split.ok ? round(split) : { ok: false, share: [r3(split.share[0]), r3(split.share[1])], dist: r3(split.dist), sep: r3(split.sep) }
    const a = st.active
    const toActive = a && split.ok ? matchGroups(a.c, split.c) : null
    if (a && toActive) {
      a.c = split.c; a.missing = 0; a.lastSeen = tick; a.last = round(split)
      if (toActive.swap) { a.ids = [a.ids[1], a.ids[0]] }
      out.ids = [...a.ids]
      st.candidate = null
      return this.finish(st, out, gen)
    }
    if (a && ++a.missing >= VARIETY.releaseDays) this.end(s, st, tick, log, 'gone')
    if (!split.ok) { st.candidate = null; return this.finish(st, out, gen) }
    const c = st.candidate
    if (c && matchGroups(c.c, split.c)) { c.samples++; c.c = split.c } else st.candidate = { since: tick, sinceGen: gen, samples: 1, c: split.c }
    const cand = st.candidate!
    if (!st.active && cand.samples >= VARIETY.persistDays && gen - cand.sinceGen >= VARIETY.persistGenerations) {
      const ids: [number, number] = [st.next, st.next + 1]
      st.next += 2
      st.active = { ids, since: cand.since, confirmed: tick, sinceGen: cand.sinceGen, c: split.c, missing: 0, lastSeen: tick, last: round(split) }
      st.candidate = null
      out.ids = [...ids]
      const diff = mainDifference(split)
      const [one, many] = NAME[s]
      log.record({ kind: 'variety', species: s, key: `${s}:${ids[0]}`, tick,
        text: `Two observed ecological varieties of ${many}: ${one} variety ${ids[0]} (${pct(split.share[0])}) and variety ${ids[1]} (${pct(split.share[1])}) `
          + `have differed in inherited behaviour for ${cand.samples} daily samples in a row (since day ${day(cand.since)}), mostly in ${LABEL[diff.trait]} `
          + `(${diff.a.toFixed(2)} vs ${diff.b.toFixed(2)}).`,
        caveat: VARIETY_CAVEAT,
        evidence: { measure: 'Deterministic 2-means on the inherited traits (food seeking, threat avoidance, cruising pace, cover seeking), each on its fixed scale.',
          threshold: `A clear gap (separation above ${VARIETY.minSeparation}), the smaller group at least ${pct(VARIETY.minShare)}, centroids at least ${VARIETY.minDistance} apart, `
            + `in ${VARIETY.persistDays} consecutive daily samples while the mean generation rose by at least ${VARIETY.persistGenerations}.`,
          since: cand.since, samples: cand.samples,
          values: { share: r3(split.share[1]), distance: r3(split.dist), separation: r3(split.sep), days: Math.round((tick - cand.since) / 24) + 1, generations: r3(gen - cand.sinceGen) } } })
    }
    return this.finish(st, out, gen)
  }

  private finish(st: SpeciesState, out: VarietyDay, gen: number): VarietyDay {
    if (st.active) out.since = st.active.since
    if (st.candidate) out.candidate = { since: st.candidate.since, samples: st.candidate.samples, generations: r3(gen - st.candidate.sinceGen) }
    return out
  }

  private end(s: Species, st: SpeciesState, tick: number, log: Journal, why: 'gone' | 'died out'): void {
    const a = st.active!
    const [one, many] = NAME[s]
    const persisted = Math.round((a.lastSeen - a.since) / 24) + 1
    const [lo, hi] = [...a.ids].sort((x, y) => x - y)
    log.release(`${s}:${lo}`, tick)
    log.record({ kind: 'variety', species: s, key: `${s}:${lo}:end`, tick,
      text: why === 'died out' ? `${one} varieties ${lo} and ${hi} ended: ${many} died out.`
        : `${one} varieties ${lo} and ${hi} are no longer measured as separate groups (last seen on day ${day(a.lastSeen)}, `
          + `when variety ${a.ids[1]} was ${pct(a.last.share[1])}). They merged back, one was lost, or the difference changed.`,
      caveat: VARIETY_CAVEAT,
      evidence: { measure: 'Deterministic 2-means on the inherited traits, each on its fixed scale.',
        threshold: why === 'died out' ? 'The species died out.' : `${VARIETY.releaseDays} consecutive daily samples without a matching split.`,
        since: a.since, samples: persisted,
        values: { share: a.last.share[1], distance: a.last.dist, separation: a.last.sep, days: persisted } } })
    st.active = null
  }

  /** The latest daily record at or before `tick`. */
  at(tick: number): VarietyDays | undefined {
    for (let i = this.days.length - 1; i >= 0; i--) if (this.days[i].tick <= tick) return this.days[i]
    return undefined
  }

  /** The persistent variety of an animal (its frame row) at `tick`: the nearest group centroid. */
  varietyOf(species: Species, row: Float32Array, tick: number): { id: number; day: VarietyDay } | null {
    const d = this.at(tick)?.[species]
    const split = d?.split
    if (!d?.ids || !split?.ok) return null
    const dist = (c: number[]) => DIMS.reduce((a, dim, j) => a + (row[dim.col] / dim.scale - c[j]) ** 2, 0)
    return { id: d.ids[dist(split.c[1]) < dist(split.c[0]) ? 1 : 0], day: d }
  }

  /** Forget daily samples after `tick` (a rewind of a few hours). */
  truncate(tick: number): void {
    while ((this.days.at(-1)?.tick ?? -1) > tick) this.days.pop()
    let restored: VarietyState | undefined
    while ((this.undo.at(-1)?.tick ?? -1) > tick) restored = this.undo.pop()!.state
    if (restored) this.state = restored
  }

  save() { return { days: this.days, state: this.state, undo: this.undo } }
  restore(data: ReturnType<VarietyTracker['save']> | undefined): void {
    const ok = (data?.days ?? []).every(d => this.species.every(s => { const sp = d[s]?.split; return !sp || !('c' in sp) || sp.c[0].length === DIMS.length }))
    this.days = ok ? structuredClone(data?.days ?? []) : []
    this.state = ok ? structuredClone(data?.state ?? { species: {} }) : { species: {} }
    this.undo = ok ? structuredClone(data?.undo ?? []) : []
  }
}
