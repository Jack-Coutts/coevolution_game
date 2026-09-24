import { describe, expect, it } from 'vitest'
import fixtures from './fixtures/python-reference.json'
import { benchmarkParams } from '@/sim/params'
import { PyRandom } from '@/sim/rng'
import { runHeadless } from '@/sim/sim'

describe('PyRandom', () => {
  it('matches CPython random.Random(0)', () => {
    const r = new PyRandom(0)
    expect(r.random()).toBe(0.8444218515250481)
    expect(r.uniform(0, 2 * Math.PI)).toBe(4.7623679680665845)
    expect(r.gauss(0, 0.1)).toBe(-0.0679714448078421)
    expect(r.gauss(0, 0.1)).toBe(0.037050356746065986)
  })
})

describe('classic rules match the Python benchmark', () => {
  for (const ref of fixtures.runs) {
    it(`seed ${ref.seed}`, () => {
      const got = runHeadless(benchmarkParams(), ref.seed)
      expect({
        survival_ticks: got.survival_ticks,
        prey_end: got.prey_end,
        predator_end: got.predator_end,
        survived: got.survived,
      }).toEqual({
        survival_ticks: ref.survival_ticks,
        prey_end: ref.prey_end,
        predator_end: ref.predator_end,
        survived: ref.survived,
      })
    })
  }
})
