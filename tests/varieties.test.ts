import { describe, expect, it } from 'vitest'
import { RunHistory } from '@/game/history'
import { detectSplit, VARIETY } from '@/game/varieties'
import type { EvolutionSample } from '@/sim/evolution'
import { Rng } from '@/sim/rng'
import { ANIMAL_STRIDE, STAT_STRIDE, type FrameData } from '@/worker/protocol'

const D = 24
/** A group of animals: its share, mean traits [forage, flee, cruise, hide] and spread. */
interface Group { share: number; mean: number[]; sd?: number }
const ONE: Group[] = [{ share: 1, mean: [0.3, 0.2, 0.5, 0] }]
/** Two groups 0.6 apart in cover seeking (six spreads). */
const TWO: Group[] = [{ share: 0.7, mean: [0.3, 0.2, 0.5, -0.3] }, { share: 0.3, mean: [0.3, 0.2, 0.5, 0.3] }]
const shift = (groups: Group[], by: number): Group[] => groups.map(g => ({ ...g, mean: g.mean.map((v, j) => (j === 0 ? v + by : v)) }))

function points(groups: Group[], n: number, rng: Rng): number[][] {
  const out: number[][] = []
  for (const g of groups) for (let i = 0; i < Math.round(g.share * n); i++) out.push(g.mean.map(m => rng.gauss(m, g.sd ?? 0.1)))
  return out
}

function frame(tick: number, groups: Group[], rng: Rng, gen: number, n = 120): FrameData {
  const pts = points(groups, n, rng)
  const rows = new Float32Array(pts.length * ANIMAL_STRIDE)
  pts.forEach((p, i) => { const o = i * ANIMAL_STRIDE; rows[o] = i + 1; rows[o + 9] = gen; p.forEach((v, j) => (rows[o + 17 + j] = v)) })
  return { tick, prey: rows, preds: new Float32Array(), bushes: new Float32Array(), events: new Float32Array() }
}

const flat = { mean: 0, low: 0, high: 0 }
const pop = (count: number) => ({ count, generation: 1, lineages: 1, neurons: 0, traits: { forage: flat, flee: flat, cruise: flat, hide: flat } })
const sample = (tick: number): EvolutionSample => ({ tick, prey: pop(120), pred: pop(0), vole: pop(0) })

/** Feed one daily sample per entry of `days` (the populations of that day), with the mean generation rising `genPerDay`. */
function run(days: Group[][], h = new RunHistory(8760, true), from = 0, genPerDay = 0.25, seed = 1): RunHistory {
  const rng = new Rng(seed + from)
  days.forEach((groups, i) => {
    const tick = (from + i) * D
    h.add(frame(tick, groups, rng, Math.floor((from + i) * genPerDay)), new Float64Array(STAT_STRIDE), 0)
    h.addEvolution(sample(tick))
  })
  return h
}
const repeat = <T,>(n: number, v: T): T[] => Array<T>(n).fill(v)
const entries = (h: RunHistory) => h.journal.filter(e => e.kind === 'variety')
const idsOn = (h: RunHistory) => h.varieties.days.map(d => d.prey?.ids?.join(',') ?? '')

describe('split detection (one daily sample)', () => {
  it('does not split a single group, even with correlated traits, in 200 random samples', () => {
    const rng = new Rng(3)
    let found = 0
    for (let k = 0; k < 100; k++) if (detectSplit(points(ONE, 120, rng))?.ok) found++
    // One latent factor drives all four traits: a stretched, still single-peaked cloud.
    for (let k = 0; k < 100; k++) {
      const pts = Array.from({ length: 120 }, () => { const f = rng.gauss(0, 0.3); return [f, 0.8 * f, -f, 0.5 * f].map(v => v + rng.gauss(0, 0.03)) })
      if (detectSplit(pts)?.ok) found++
    }
    expect(found).toBe(0)
  })

  it('finds two clearly separate groups with their shares and centroids', () => {
    const s = detectSplit(points(TWO, 120, new Rng(4)))!
    expect(s.ok).toBe(true)
    expect(s.share[0]).toBeCloseTo(0.7, 1)
    expect(s.c[0][3]).toBeCloseTo(-0.3, 1)
    expect(s.c[1][3]).toBeCloseTo(0.3, 1)
    expect(s.sep).toBeGreaterThan(VARIETY.minSeparation)
  })

  it('limits: misses overlapping groups (2 spreads apart) and a group under 15%', () => {
    const rng = new Rng(5)
    const close: Group[] = [{ share: 0.5, mean: [0, 0, 0, -0.1] }, { share: 0.5, mean: [0, 0, 0, 0.1] }]
    const rare: Group[] = [{ share: 0.9, mean: [0, 0, 0, -0.3] }, { share: 0.1, mean: [0, 0, 0, 0.3] }]
    expect(detectSplit(points(close, 200, rng))?.ok).toBe(false)
    const r = detectSplit(points(rare, 200, rng))!
    expect(r.ok).toBe(false)
    expect(r.share[1]).toBeCloseTo(0.1, 2)
  })
})

describe('persistent varieties', () => {
  it('names a two-group population once, after 20 daily samples, and keeps the names', () => {
    const h = run(repeat(80, TWO))
    const recorded = entries(h)
    expect(recorded).toHaveLength(1)
    const [e] = recorded
    expect(e.tick).toBe((VARIETY.persistDays - 1) * D)
    expect(e.text).toMatch(/^Two observed ecological varieties of rabbits: Rabbit variety 1 \(70%\) and variety 2 \(30%\) have differed .* for 20 daily samples in a row \(since day 1\), mostly in cover seeking \(-0\.30 vs 0\.30\)\.$/)
    expect(e.text).not.toMatch(/subspecies/)
    expect(e.caveat).toMatch(/not subspecies/)
    expect(e.kind === 'variety' && e.evidence.values).toMatchObject({ days: 20, generations: 4 })
    expect(new Set(idsOn(h).slice(19))).toEqual(new Set(['1,2']))
  })

  it('never names a single group, drifting or not', () => {
    const h = run(Array.from({ length: 120 }, (_, i) => shift(ONE, i * 0.01)))
    expect(entries(h)).toHaveLength(0)
    expect(h.varieties.days.filter(d => d.prey?.split?.ok)).toHaveLength(0)
  })

  it('follows two drifting groups under the same names', () => {
    const h = run(Array.from({ length: 150 }, (_, i) => shift(TWO, i * 0.01)))
    expect(entries(h)).toHaveLength(1)
    expect(new Set(idsOn(h).slice(19))).toEqual(new Set(['1,2']))
    const last = h.varieties.days.at(-1)!.prey!.split!
    expect('c' in last && last.c[0][0]).toBeCloseTo(0.3 + 1.49, 1)
  })

  it('ignores temporary splits: 15 days, or 15 + 15 with a break, or 40 days within one generation', () => {
    expect(entries(run([...repeat(15, TWO), ...repeat(40, ONE)]))).toHaveLength(0)
    expect(entries(run([...repeat(15, TWO), ONE, ...repeat(15, TWO)]))).toHaveLength(0)
    expect(entries(run(repeat(40, TWO), undefined, 0, 0.04))).toHaveLength(0)
  })

  it('records the end after 10 days without the split, and later splits get new names', () => {
    const h = run([...repeat(30, TWO), ...repeat(12, ONE), ...repeat(25, TWO)])
    const recorded = entries(h)
    expect(recorded.map(e => e.tick / D)).toEqual([19, 39, 41 + 20])
    expect(recorded[1].text).toMatch(/^Rabbit varieties 1 and 2 are no longer measured as separate groups \(last seen on day 30, when variety 2 was 3\d%\)\. They merged back, one was lost, or the difference changed\.$/)
    expect(recorded[1].kind === 'variety' && recorded[1].evidence.values.days).toBe(30)
    expect(recorded[2].text).toContain('Rabbit variety 3 (70%) and variety 4 (30%)')
  })

  it('ends the varieties at once when the species dies out; too few animals neither extend nor end them', () => {
    const few: Group[] = [{ share: 1, mean: [0, 0, 0, 0] }]
    const h = new RunHistory(8760, true)
    run(repeat(25, TWO), h)
    const rng = new Rng(9)
    for (const [i, n] of [[25, 10], [26, 10], [27, 0]] as const) {
      h.add(frame(i * D, few, rng, 9, n), new Float64Array(STAT_STRIDE), 0)
      h.addEvolution(sample(i * D))
      if (n > 0) expect(entries(h)).toHaveLength(1)
    }
    expect(entries(h).at(-1)!.text).toBe('Rabbit varieties 1 and 2 ended: rabbits died out.')
  })

  it('treats a different split (another trait) as new, not as the same varieties', () => {
    const other: Group[] = [{ share: 0.6, mean: [-0.3, 0.2, 0.5, 0] }, { share: 0.4, mean: [0.3, 0.2, 0.5, 0] }]
    const h = run([...repeat(25, TWO), ...repeat(35, other)])
    expect(entries(h).map(e => e.tick / D)).toEqual([19, 34, 44])
    expect(entries(h)[2].text).toMatch(/Rabbit variety 3 \(60%\) and variety 4 \(40%\) .* mostly in food seeking/)
  })

  it('assigns an animal to the nearest variety for the inspector', () => {
    const h = run(repeat(25, TWO))
    const row = new Float32Array(ANIMAL_STRIDE)
    row.set([0.3, 0.2, 0.5, 0.28], 17)
    expect(h.varieties.varietyOf('prey', row, 24 * D)?.id).toBe(2)
    row[20] = -0.25
    expect(h.varieties.varietyOf('prey', row, 24 * D)?.id).toBe(1)
    expect(h.varieties.varietyOf('prey', row, 10 * D)).toBeNull()
  })

  it('survives save and resume exactly; a save cut hours before the naming day forgets it', () => {
    const a = run(repeat(15, TWO))
    const b = new RunHistory(8760, true)
    b.restore(structuredClone(a.save()))
    run(repeat(30, TWO), a, 15)
    run(repeat(30, TWO), b, 15)
    expect(b.varieties.save()).toEqual(a.varieties.save())
    expect(entries(b)).toEqual(entries(a))
    // A save made a few hours before the naming day (the world is saved at an earlier hour than the latest shown).
    const c = run(repeat(21, TWO))
    expect(entries(c)).toHaveLength(1)
    const cut = new RunHistory(8760, true)
    cut.restore(structuredClone(c.save(19 * D - 5)))
    expect(entries(cut)).toHaveLength(0)
    expect(cut.varieties.days.at(-1)!.tick).toBe(18 * D)
    run(repeat(3, TWO), cut, 19)
    expect(entries(cut).map(e => e.tick)).toEqual([19 * D])
  })

  it('keeps bounded state in a long run', () => {
    const h = run(repeat(VARIETY.days + 40, TWO))
    expect(h.varieties.days).toHaveLength(VARIETY.days)
    expect(JSON.stringify(h.varieties.save()).length).toBeLessThan(200_000)
  })
})
