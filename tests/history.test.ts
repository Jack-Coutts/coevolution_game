import { describe, expect, it } from 'vitest'
import { RunHistory } from '@/game/history'
import type { EvolutionSample } from '@/sim/evolution'
import { STAT, STAT_STRIDE, type FrameData } from '@/worker/protocol'

const frame = (tick: number): FrameData => ({ tick, prey: new Float32Array(), preds: new Float32Array(), bushes: new Float32Array(), events: new Float32Array() })
const row = (prey: number) => {
  const r = new Float64Array(STAT_STRIDE)
  r[STAT.prey] = prey
  return r
}
const trait = { mean: 0, low: 0, high: 0 }
const population = (count: number, generation: number) => ({ count, generation, lineages: 1, neurons: 4, traits: { forage: trait, flee: trait, cruise: trait, hide: trait } })
const sample = (tick: number, generation: number): EvolutionSample => ({ tick, prey: population(10, generation), pred: population(3, 1) })

function history(until: number): RunHistory {
  const h = new RunHistory(8760)
  for (let t = 0; t <= until; t++) h.add(frame(t), row(t), 0)
  return h
}

describe('run history', () => {
  it('keeps the whole graph after a resume, with replay only from the saved window', () => {
    const saved = history(1000).save()
    const h = new RunHistory(8760)
    h.restore(structuredClone(saved))
    expect([h.firstTick, h.replayStart, h.head]).toEqual([0, 640, 1000])
    expect(h.stat(10, 'prey')).toBe(10)
    expect(h.frameAt(10)?.a.tick).toBe(641)
  })

  it('reads the replay start of a save made before it was stored separately', () => {
    const saved = history(1000).save() as Partial<ReturnType<RunHistory['save']>>
    delete saved.replayFrom
    const h = new RunHistory(8760)
    h.restore({ ...(saved as ReturnType<RunHistory['save']>), start: 640 })
    expect([h.firstTick, h.replayStart]).toEqual([640, 640])
  })

  it('forgets hours after an intervention rewinds the worker', () => {
    const h = history(100)
    h.addEvolution(sample(48, 5))
    h.addEvolution(sample(72, 6))
    h.addEvolution(sample(96, 10))
    h.truncate(80)
    expect(h.head).toBe(80)
    expect(h.frame(81)).toBeUndefined()
    expect(h.evolution.map(e => e.tick)).toEqual([48, 72])
    expect(h.journal.map(e => e.tick)).toEqual([])
  })
})
