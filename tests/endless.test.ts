import { describe, it, expect } from 'vitest'
import { Sim } from '@/sim/sim'
import { deriveParams } from '@/sim/levers'
import { STABLE_PRESET } from '@/game/presets'
import { SCENARIO_BY_ID } from '@/sim/scenarios'
import { RunHistory, HISTORY_HOURS } from '@/game/history'
import { STAT, STAT_STRIDE, type FrameData } from '@/worker/protocol'
import { summarizeEvolution } from '@/sim/evolution'

const p = () => deriveParams(STABLE_PRESET)
describe('persistent worlds', () => {
  it('resumes exactly, including random streams, memory, newborns, food and queued actions', () => {
    const params = p(); Object.assign(params.eco, { hidden: 4, memory: true, growRate: 0.02 })
    const a = new Sim(params, 104, undefined, { record: true })
    for (let i = 0; i < 180; i++) a.step()
    a.queue('releasePrey')
    const b = Sim.restore(structuredClone(a.save()))
    for (let i = 0; i < 240; i++) { a.step(); b.step() }
    expect(b.tick).toBeGreaterThan(180)
    expect(b.save()).toEqual(a.save())
    expect(summarizeEvolution(b)).toEqual(summarizeEvolution(a))
  })
  it('continues beyond the challenge cutoff and repeats winter at the same time each year', () => {
    const params = p(); params.horizon = 3; params.endless = true
    const s = new Sim(params, 7, SCENARIO_BY_ID.winter.disturbance)
    for (let i = 0; i < 10; i++) s.step()
    expect(s.tick).toBe(10)
    expect(s.ended).toBe(false)
    expect(s.survived).toBe(false)
    expect(s.metabolismFactor(2400)).toBe(1.35)
    expect(s.metabolismFactor(8760 + 2400)).toBe(1.35)
    expect(s.metabolismFactor(8760)).toBe(1)
  })
  it('bounds history while preserving accurate recent statistics and replay', () => {
    const h = new RunHistory(8760, true)
    for (let t = 0; t < HISTORY_HOURS * 3; t++) {
      const f: FrameData = { tick: t, prey: new Float32Array(), preds: new Float32Array(), bushes: new Float32Array(), events: new Float32Array() }
      const row = new Float64Array(STAT_STRIDE); row[STAT.prey] = t
      h.add(f, row, 0)
    }
    expect(h.stats.length).toBe((HISTORY_HOURS + 1) * STAT_STRIDE)
    expect(h.stat(h.head - 200, 'prey')).toBe(h.head - 200)
    expect(h.frame(0)).toBeUndefined()
    expect(h.frameAt(0)?.a.tick).toBeGreaterThanOrEqual(h.firstTick)
    expect(h.frameAt(h.head)?.a.tick).toBe(h.head)
    expect(h.horizon).toBeGreaterThan(h.head)
  })
  it('samples control newborns from the fixed founder pool, not successful parents or fresh genomes', () => {
    const params = p(); params.eco.heredity = false
    const s = new Sim(params, 9)
    const originals = s.prey.map(a => [...a.brain.w])
    for (const a of s.prey) { a.age = params.prey.adultAge; a.energy = params.prey.maxEnergy }
    s.step()
    const children = s.prey.filter(a => a.gen > 0)
    expect(children.length).toBeGreaterThan(0)
    for (const child of children) expect(originals).toContainEqual([...child.brain.w])
  })
})
it('records a generation milestone once even if the highest living generation later falls', () => {
  const sample = summarizeEvolution(new Sim(p(), 1))
  const h = new RunHistory(8760)
  h.addEvolution(sample)
  for (const [tick, generation] of [[24, 5], [48, 4], [72, 5]]) {
    const next = structuredClone(sample); next.tick = tick; next.prey.generation = generation
    h.addEvolution(next)
  }
  expect(h.journal.filter(e => e.text.includes('Rabbit descendants'))).toHaveLength(1)
})
