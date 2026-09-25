import { describe, expect, it } from 'vitest'
import { RunHistory } from '@/game/history'
import { FAMILY_DAYS } from '@/game/families'
import { JOURNAL_LIMIT, normalize, TRAIT_SHIFT } from '@/game/journal'
import type { EvolutionSample } from '@/sim/evolution'
import { ANIMAL_STRIDE, STAT_STRIDE, type FrameData } from '@/worker/protocol'

const D = 24
const flat = { mean: 0, low: -0.4, high: 0.4 }
const pop = (count: number, forage = 0, generation = 1, lineages = 3) => ({ count, generation, lineages, neurons: 0,
  traits: { forage: { mean: forage, low: forage - 0.3, high: forage + 0.3 }, flee: flat, cruise: flat, hide: flat } })
const sample = (day: number, forage: number, count = 40, generation = 1): EvolutionSample =>
  ({ tick: day * D, prey: pop(count, forage, generation), pred: pop(12) })

/** Animals as frame rows: [id, generation, parent, lineage]. */
function frame(tick: number, prey: [number, number, number, number][] = []): FrameData {
  const rows = new Float32Array(prey.length * ANIMAL_STRIDE)
  prey.forEach(([id, gen, parent, lineage], i) => { rows[i * ANIMAL_STRIDE] = id; rows[i * ANIMAL_STRIDE + 9] = gen; rows[i * ANIMAL_STRIDE + 11] = parent; rows[i * ANIMAL_STRIDE + 12] = lineage })
  return { tick, prey: rows, preds: new Float32Array(), bushes: new Float32Array(), events: new Float32Array() }
}

/** Feed daily samples of rabbit food seeking (index = day), with frames so the hours exist. */
function run(means: number[], h = new RunHistory(8760, true), from = 0, count = 40): RunHistory {
  means.forEach((m, i) => {
    const day = from + i
    h.add(frame(day * D), new Float64Array(STAT_STRIDE), 0)
    h.addEvolution(sample(day, m, count))
  })
  return h
}
const shifts = (h: RunHistory) => h.journal.filter(e => e.kind === 'traitShift')
const repeat = (n: number, v: number) => Array<number>(n).fill(v)

describe('trait-shift entries', () => {
  it('records a sustained rise once, on the 20th qualifying daily sample, with its evidence', () => {
    const h = run([0.02, ...repeat(4, 0.1), ...repeat(20, 0.31)])
    expect(shifts(h)).toHaveLength(1)
    const [e] = shifts(h)
    expect(e.tick).toBe(24 * D)
    expect(e.text).toBe('Rabbit food seeking has risen from 0.02 among the founders to 0.31, staying at least 0.25 higher for 20 daily samples in a row (since day 6).')
    expect(e.caveat).toContain('does not show why')
    expect(e.kind === 'traitShift' && e.evidence).toMatchObject({ trait: 'forage', direction: 1, since: 5 * D, samples: 20, fewest: 40, threshold: 0.25,
      baseline: { tick: 0, mean: 0.02 }, now: { tick: 24 * D, mean: 0.31, low: 0.31 - 0.3, high: 0.31 + 0.3 } })
  })

  it('needs an unbroken run: 19 samples, a dip under the threshold, then 19 more records nothing', () => {
    const h = run([0, ...repeat(19, 0.3), 0.2, ...repeat(19, 0.3)])
    expect(shifts(h)).toHaveLength(0)
    run([0.3], h, 40)
    expect(shifts(h).map(e => e.tick)).toEqual([40 * D])
  })

  it('does not repeat while the mean stays shifted or only dips part-way back', () => {
    const h = run([0, ...repeat(25, 0.3), ...repeat(5, 0.2), ...repeat(40, 0.35)])
    expect(shifts(h)).toHaveLength(1)
  })

  it('records again after the mean returns near the baseline and crosses again', () => {
    const h = run([0, ...repeat(20, 0.3), 0.1, ...repeat(20, 0.3)])
    expect(shifts(h).map(e => e.tick)).toEqual([20 * D, 41 * D])
  })

  it('records each direction separately, and a fall reads as fallen', () => {
    const h = run([0, ...repeat(20, 0.3), ...repeat(20, -0.3)])
    expect(shifts(h).map(e => e.kind === 'traitShift' && e.evidence.direction)).toEqual([1, -1])
    expect(shifts(h)[1].text).toMatch(/^Rabbit food seeking has fallen from 0\.00 among the founders to -0\.30/)
  })

  it('ignores samples with too few animals, and an extinction neither counts as a return nor a shift', () => {
    expect(shifts(run([0, ...repeat(30, 0.4)], undefined, 0, TRAIT_SHIFT.minCount - 1))).toHaveLength(0)
    const h = run([0, ...repeat(20, 0.3)])
    h.add(frame(21 * D), new Float64Array(STAT_STRIDE), 0)
    h.addEvolution(sample(21, 0, 0))
    h.add(frame(22 * D), new Float64Array(STAT_STRIDE), 0)
    h.addEvolution(sample(22, 0, 0))
    expect(h.journal.map(e => e.kind)).toEqual(['traitShift', 'extinction'])
    expect(h.journal[1].text).toBe('Rabbits died out. The last ones were generation 1.')
    expect(h.journal[1].kind === 'extinction' && h.journal[1].evidence).toEqual({ lastCount: 40, lastGeneration: 1, lastSeen: 21 * D - D })
  })

  it('never claims a cause or an advantage', () => {
    const h = run([0, ...repeat(20, 0.3), 0, ...repeat(20, -0.3)])
    for (const e of h.journal) expect(`${e.text} ${e.caveat ?? ''}`).not.toMatch(/\b(because|adapt\w*|advantage|in order to|so that|better|fitter)\b/i)
  })
})

describe('journal persistence and bounds', () => {
  it('gives the same entries after a save and resume mid-run, without duplicating a recorded shift', () => {
    const means = [0, ...repeat(30, 0.3), 0.05, ...repeat(25, 0.3)]
    const straight = run(means)
    const first = run(means.slice(0, 25))
    const resumed = new RunHistory(8760, true)
    const saved = structuredClone({ history: first.save(), evolution: first.evolution, journal: first.journal })
    resumed.restore(saved.history, saved.journal)
    resumed.evolution = saved.evolution
    run(means.slice(25), resumed, 25)
    expect(resumed.journal).toEqual(straight.journal)
    expect(shifts(resumed).map(e => e.tick)).toEqual([20 * D, 51 * D])
  })

  it('reads journals from older saves as plain notes', () => {
    const h = new RunHistory(8760, true)
    const saved = run([0, 0]).save() as Partial<ReturnType<RunHistory['save']>>
    delete saved.journal
    h.restore(saved as ReturnType<RunHistory['save']>, [{ tick: 48, text: 'Rabbit descendants reached generation 5.' }])
    expect(h.journal).toEqual([{ kind: 'note', tick: 48, text: 'Rabbit descendants reached generation 5.' }])
    expect(normalize(undefined)).toEqual([])
  })

  it('forgets entries and latches after a rewind, so the shift is recorded again when re-reached', () => {
    const h = run([0, ...repeat(22, 0.3)])
    h.truncate(19 * D)
    expect(shifts(h)).toHaveLength(0)
    run(repeat(3, 0.3), h, 20)
    expect(shifts(h).map(e => e.tick)).toEqual([20 * D])
  })

  it('keeps the latest 80 entries and counts the dropped ones', () => {
    const h = new RunHistory(8760, true)
    for (let day = 0; day <= 100; day++) {
      h.add(frame(day * D), new Float64Array(STAT_STRIDE), 0)
      h.addEvolution(sample(day, 0, 40, day * 5))
    }
    expect(h.journal).toHaveLength(JOURNAL_LIMIT)
    expect(h.log.dropped).toBe(100 - JOURNAL_LIMIT)
    expect(h.journal[0].text).toBe('Rabbit descendants reached generation 105.')
  })

  it('links a generation milestone to the eldest living animal and its family', () => {
    const h = new RunHistory(8760)
    h.add(frame(0, [[1, 0, -1, 1]]), new Float64Array(STAT_STRIDE), 0)
    h.addEvolution(sample(0, 0))
    h.add(frame(D, [[7, 5, 3, 2], [4, 5, 2, 1], [9, 4, 7, 2]]), new Float64Array(STAT_STRIDE), 0)
    h.addEvolution(sample(1, 0, 40, 5))
    expect(h.journal[0]).toMatchObject({ kind: 'generation', animal: { species: 'prey', id: 4 }, lineage: { species: 'prey', id: 1 }, evidence: { generation: 5, every: 5 } })
  })
})

describe('family history', () => {
  const day = (h: RunHistory, d: number, prey: [number, number, number, number][]) => {
    h.add(frame(d * D, prey), new Float64Array(STAT_STRIDE), 0)
    h.addEvolution(sample(d, 0))
  }
  it('summarises each founder family from daily frames', () => {
    const h = new RunHistory(8760)
    day(h, 0, [[1, 0, -1, 1], [2, 0, -1, 2]])
    day(h, 1, [[1, 0, -1, 1], [3, 1, 1, 1], [4, 1, 1, 1], [2, 0, -1, 2]])
    day(h, 2, [[3, 1, 1, 1], [5, 2, 3, 1]])
    expect(h.families.summaries('prey', 2 * D)).toEqual([
      { species: 'prey', founder: 1, firstSeen: 0, lastSeen: 2 * D, living: 2, peak: 3, peakTick: D, minGen: 0, maxGen: 2 },
      { species: 'prey', founder: 2, firstSeen: 0, lastSeen: D, living: 0, peak: 1, peakTick: 0, minGen: 0, maxGen: 0 },
    ])
    // As of day 2 (index 1), both families are alive.
    expect(h.families.summaries('prey', D).map(l => [l.founder, l.living])).toEqual([[1, 3], [2, 1]])
    const copy = new RunHistory(8760)
    copy.restore(structuredClone(h.save()))
    expect(copy.families.summaries('prey', 2 * D)).toEqual(h.families.summaries('prey', 2 * D))
    h.truncate(D)
    expect(h.families.summaries('prey', 9 * D).map(l => [l.founder, l.living])).toEqual([[1, 3], [2, 1]])
  })

  it('stays bounded over years, keeping first-seen and peak of folded days', () => {
    const h = new RunHistory(8760, true)
    for (let d = 0; d < FAMILY_DAYS + 50; d++) day(h, d, d < 10 ? [[1, 0, -1, 1], [2, 0, -1, 2]] : [[1, 0, -1, 1]])
    expect(h.families.days).toHaveLength(FAMILY_DAYS)
    expect(h.families.countedFrom).toBe(50 * D)
    expect(h.families.summaries('prey', 1e9).map(l => [l.founder, l.firstSeen, l.lastSeen, l.living, l.peak])).toEqual([[1, 0, (FAMILY_DAYS + 49) * D, 1, 1], [2, 0, 9 * D, 0, 1]])
  })
})

describe('last seen', () => {
  it('finds the last kept hour an animal was alive, or null when the kept replay never shows it', () => {
    const h = new RunHistory(8760)
    for (let t = 0; t <= 1000; t++) h.add(frame(t, t <= 30 || (t >= 700 && t <= 710) ? [[t <= 30 ? 5 : 6, 2, 1, 1]] : []), new Float64Array(STAT_STRIDE), 0)
    expect(h.lastSeen('prey', 5, 1000)?.tick).toBe(30)
    expect(h.lastSeen('prey', 5, 12)?.tick).toBe(12)
    expect(h.lastSeen('prey', 9, 1000)).toBeNull()
    // A resume keeps only the last 15 days of replay (from hour 640): animal 6 is still there, animal 5 is not.
    const resumed = new RunHistory(8760)
    resumed.restore(structuredClone(h.save()))
    expect(resumed.lastSeen('prey', 6, 1000)?.tick).toBe(710)
    expect(resumed.lastSeen('prey', 5, 1000)).toBeNull()
  })
})

describe('audit: rewinds and save cuts after a re-recorded shift', () => {
  // Recorded day 20, released day 25 (0.1), recorded again day 45.
  const means = [0, ...repeat(24, 0.3), 0.1, ...repeat(20, 0.3)]
  it('keeps the earlier latch after a rewind past the second recording', () => {
    const h = run(means)
    expect(shifts(h).map(e => e.tick / D)).toEqual([20, 45])
    h.truncate(22 * D)
    run(repeat(8, 0.3), h, 23)
    expect(shifts(h).map(e => e.tick / D)).toEqual([20])
  })
  it('keeps the earlier latch in a save cut before the second recording', () => {
    const h = run(means)
    const saved = structuredClone({ history: h.save(22 * D), evolution: h.evolution.filter(e => e.tick <= 22 * D) })
    const resumed = new RunHistory(8760, true)
    resumed.restore(saved.history)
    resumed.evolution = saved.evolution
    run(repeat(8, 0.3), resumed, 23)
    expect(shifts(resumed).map(e => e.tick / D)).toEqual([20])
  })
})

describe('audit: a resume at a non-daily hour', () => {
  it('records on the same day as an uninterrupted run and adds no off-day family count', () => {
    const h = run([0, ...repeat(10, 0.3)])
    // A resume at day 10 + 5 h: the worker reports the world at that hour.
    const at = 10 * D + 5
    h.add(frame(at, [[1, 3, -1, 1]]), new Float64Array(STAT_STRIDE), 0)
    h.addEvolution({ ...sample(10, 0.3), tick: at })
    run(repeat(12, 0.3), h, 11)
    expect(shifts(h).map(e => e.tick / D)).toEqual([20])
    expect(h.families.days.map(d => d.tick % D)).not.toContain(5)
  })
  it('still records an extinction from the end-of-run sample', () => {
    const h = run([0, 0])
    h.add(frame(D + 7), new Float64Array(STAT_STRIDE), 0)
    h.addEvolution({ ...sample(1, 0, 0), tick: D + 7 }, true)
    expect(h.journal.map(e => [e.kind, e.tick])).toEqual([['extinction', D + 7]])
  })
})
