import { describe, expect, it } from 'vitest'
import { RunHistory } from '@/game/history'
import { explain, hints, scoreWords } from '@/game/insights'
import { actionsFor, optionCount } from '@/game/interventions'
import { STABLE_PRESET } from '@/game/presets'
import { displayOrder, framePop, speciesPhrase } from '@/game/species-ui'
import { deriveParams, LEVER_BY_ID, leversFor, spent } from '@/sim/levers'
import { SCENARIO_BY_ID } from '@/sim/scenarios'
import { THREE_SPECIES, TWO_SPECIES } from '@/sim/species'
import { ANIMAL_STRIDE, STAT, STAT_STRIDE, type EndInfo, type FrameData } from '@/worker/protocol'
import { Journal } from '@/game/journal'
import { FamilyHistory } from '@/game/families'

type Row = Partial<Record<keyof typeof STAT, number>>

const frame = (tick: number): FrameData => ({ tick, prey: new Float32Array(), preds: new Float32Array(), voles: new Float32Array(), bushes: new Float32Array(), events: new Float32Array() })

/** A Vole meadow history whose hour `t` holds `at(t)`; energy and food default to comfortable. */
function history(until: number, at: (t: number) => Row): RunHistory {
  const h = new RunHistory(8760, false, THREE_SPECIES)
  for (let t = 0; t <= until; t++) {
    const row = new Float64Array(STAT_STRIDE)
    const values: Row = { preyEnergy: 0.6, predEnergy: 0.6, stock: 0.5, seed: 0.5, ...at(t) }
    for (const [k, v] of Object.entries(values)) row[STAT[k as keyof typeof STAT]] = v
    h.add(frame(t), row, 0)
  }
  return h
}

const ids = (h: RunHistory, t: number) => hints(h, t).map(n => n.id)

describe('vole field notes', () => {
  it('holding steady names all three species and the grass seed', () => {
    const h = history(500, () => ({ prey: 100, pred: 10, vole: 80 }))
    expect(hints(h, 500)).toEqual([{ id: 'steady', tone: 'good', text: 'Holding steady: 100 rabbits, 80 voles and 10 foxes, with bushes 50% full and grass seed 50%.' }])
  })

  it('warns when grass seed runs out, more strongly when bushes are also low', () => {
    expect(hints(history(500, () => ({ prey: 100, pred: 10, vole: 80, seed: 0.1 })), 500)).toContainEqual(expect.objectContaining({ id: 'seedlow', tone: 'info' }))
    expect(hints(history(500, () => ({ prey: 100, pred: 10, vole: 80, seed: 0.1, stock: 0.2 })), 500)).toContainEqual(expect.objectContaining({ id: 'seedlow', tone: 'warn' }))
  })

  it('warns of a vole crash that will turn many foxes to rabbits', () => {
    // Voles fall from 200 to 90 over ten days with 20 foxes.
    const h = history(500, t => ({ prey: 200, pred: 20, vole: Math.round(200 - 110 * Math.min(1, Math.max(0, (t - 260) / 240))) }))
    const note = hints(h, 500).find(n => n.id === 'volecrash')
    expect(note?.text).toBe('Voles are down 55% in 10 days. The 20 foxes that lived on them will turn to rabbits.')
  })

  it('warns of a vole boom, and of few voles left', () => {
    expect(ids(history(500, t => ({ prey: 150, pred: 10, vole: t <= 260 ? 100 : 180 })), 500)).toContain('voleboom')
    const few = hints(history(500, () => ({ prey: 150, pred: 10, vole: 9 })), 500)
    expect(few[0]).toEqual(expect.objectContaining({ id: 'fewvole', tone: 'danger' }))
  })

  it('the overhunt warning mentions the vole boom a cull could release, only with many voles', () => {
    const falling = (vole: number) => history(500, t => ({ prey: Math.round(60 - 30 * Math.min(1, Math.max(0, (t - 260) / 239))), pred: 8, vole }))
    expect(hints(falling(150), 500).find(n => n.id === 'overhunt')?.text).toMatch(/Foxes also keep the 150 voles in check/)
    expect(hints(falling(40), 500).find(n => n.id === 'overhunt')?.text).not.toMatch(/voles/)
  })

  it('two-species notes never mention voles', () => {
    const h = new RunHistory(8760)
    for (let t = 0; t <= 500; t++) {
      const row = new Float64Array(STAT_STRIDE)
      row[STAT.prey] = 100; row[STAT.pred] = 10; row[STAT.stock] = 0.5; row[STAT.preyEnergy] = 0.6; row[STAT.predEnergy] = 0.6
      h.add(frame(t), row, 0)
    }
    expect(hints(h, 500).map(n => n.text).join(' ')).not.toMatch(/vole|seed/i)
  })
})

describe('vole explanations', () => {
  const end = (e: Partial<EndInfo>): EndInfo => ({ tick: 500, survived: false, preyEnd: 50, predEnd: 10, voleEnd: 0, species: ['prey', 'pred', 'vole'], ...e })

  it('voles that starved when the grass seed ran out', () => {
    const h = history(500, t => ({ prey: 50, pred: 10, vole: 0, seed: 0.05, voleStarved: t, voleEaten: t / 10 }))
    const e = explain(h, end({}), SCENARIO_BY_ID.voles)
    expect(e.headline).toMatch(/^Voles starved on .* Grass seed was eaten bare\.$/)
  })

  it('voles eaten out by foxes', () => {
    const h = history(500, t => ({ prey: 50, pred: 30, vole: 0, voleEaten: t, voleStarved: t / 10 }))
    expect(explain(h, end({}), SCENARIO_BY_ID.voles).headline).toMatch(/^Voles were eaten out on/)
  })

  it('foxes that starved after living on voles', () => {
    const h = history(500, t => ({ prey: 20, pred: 0, vole: 10, voleEaten: t, preyEaten: t / 4, predStarved: t / 10 }))
    expect(explain(h, end({ predEnd: 0, voleEnd: 10 }), SCENARIO_BY_ID.voles).headline).toMatch(/after the voles they lived on ran short/)
  })

  it('a full year names all three species', () => {
    const h = history(10, () => ({ prey: 50, pred: 10, vole: 70 }))
    expect(explain(h, end({ tick: 8760, survived: true, voleEnd: 70 }), SCENARIO_BY_ID.voles).headline).toBe('All three species made it through 1 year.')
    expect(scoreWords({ hours: 100, budgetBonus: 0, calmBonus: 0, total: 100 }, false, false, 0, 3)).toMatch(/all species last the full year/)
  })
})

describe('vole actions, levers and names', () => {
  it('offers the two vole actions only in the Vole meadow, sharing one list', () => {
    expect(actionsFor(TWO_SPECIES).map(a => a.id)).not.toContain('releaseVole')
    expect(actionsFor(THREE_SPECIES).map(a => a.id).slice(-2)).toEqual(['releaseVole', 'illnessVole'])
    expect([optionCount(TWO_SPECIES), optionCount(THREE_SPECIES)]).toEqual(['eight', 'ten'])
  })

  it('Starting voles is a Vole meadow lever; it sets the voles and costs points only there', () => {
    expect(leversFor(TWO_SPECIES).some(d => d.id === 'vole.initial')).toBe(false)
    expect(leversFor(THREE_SPECIES).some(d => d.id === 'vole.initial')).toBe(true)
    expect(STABLE_PRESET['vole.initial']).toBe(60)
    const more = { ...STABLE_PRESET, 'vole.initial': 80 }
    expect(deriveParams(more, THREE_SPECIES).vole?.body.initial).toBe(80)
    expect(spent(more, STABLE_PRESET, THREE_SPECIES)).toBe(2 * LEVER_BY_ID['vole.initial'].cost)
    expect(spent(more, STABLE_PRESET, TWO_SPECIES)).toBe(0)
    // Levers saved before the vole lever existed cost nothing extra.
    const { 'vole.initial': _, ...old } = STABLE_PRESET
    expect(spent(old, STABLE_PRESET, THREE_SPECIES)).toBe(0)
  })

  it('the Open meadow parameters do not change with the vole lever', () => {
    expect(deriveParams({ ...STABLE_PRESET, 'vole.initial': 120 }, TWO_SPECIES)).toEqual(deriveParams(STABLE_PRESET, TWO_SPECIES))
  })

  it('names species in one order: rabbits, voles, foxes', () => {
    expect(speciesPhrase(TWO_SPECIES)).toBe('rabbits and foxes')
    expect(speciesPhrase(THREE_SPECIES)).toBe('rabbits, voles and foxes')
    expect(displayOrder(THREE_SPECIES)).toEqual(['prey', 'vole', 'pred'])
    const f = frame(0)
    expect(framePop(f, 'vole')).toBe(f.voles)
    expect(framePop({ ...f, voles: undefined }, 'vole').length).toBe(0)
  })

  it('journals a vole extinction by name', () => {
    const h = new RunHistory(8760, false, THREE_SPECIES)
    const pop = (count: number) => ({ count, generation: 2, lineages: 1, neurons: 0, traits: { forage: { mean: 0, low: 0, high: 0 }, flee: { mean: 0, low: 0, high: 0 }, cruise: { mean: 0, low: 0, high: 0 }, hide: { mean: 0, low: 0, high: 0 } } })
    h.addEvolution({ tick: 24, prey: pop(10), pred: pop(3), vole: pop(5) })
    h.addEvolution({ tick: 48, prey: pop(10), pred: pop(3), vole: pop(0) })
    expect(h.journal.map(e => e.text)).toContain('Voles died out. The last ones were generation 2.')
  })
})

describe('journal and families in the Vole meadow', () => {
  const pop = (count: number, generation = 1) => ({ count, generation, lineages: 2, neurons: 0, traits: { forage: { mean: 0, low: 0, high: 0 }, flee: { mean: 0, low: 0, high: 0 }, cruise: { mean: 0, low: 0, high: 0 }, hide: { mean: 0, low: 0, high: 0 } } })

  it('notes a full year for all three species and a vole generation milestone', () => {
    const log = new Journal(false, THREE_SPECIES)
    const a = { tick: 8736, prey: pop(50), pred: pop(8), vole: pop(70, 4) }
    const b = { tick: 8760, prey: pop(50), pred: pop(8), vole: pop(70, 5) }
    log.observe([a], undefined)
    log.observe([a, b], undefined)
    const texts = log.entries.map(e => e.text)
    expect(texts).toContain('All three species lasted the full year.')
    expect(texts).toContain('Vole descendants reached generation 5.')
    expect(log.entries.find(e => e.kind === 'year')?.evidence).toMatchObject({ vole: 70 })
  })

  it('counts vole families from frames, and old two-species family saves restore', () => {
    const fam = new FamilyHistory(THREE_SPECIES)
    const voles = new Float32Array(2 * ANIMAL_STRIDE)
    voles.set([101, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 7, 7], 0)
    voles.set([102, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 101, 7], ANIMAL_STRIDE)
    fam.observe(24, { ...frame(24), voles })
    expect(fam.summaries('vole', 24)).toEqual([expect.objectContaining({ species: 'vole', founder: 7, living: 2, minGen: 2, maxGen: 3 })])
    const two = new FamilyHistory()
    two.restore({ days: [], archive: { prey: [], pred: [] } as never })
    expect(two.summaries('vole', 0)).toEqual([])
  })
})
