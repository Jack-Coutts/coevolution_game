import { describe, expect, it } from 'vitest'
import { Rng } from '@/sim/rng'

describe('Rng', () => {
  it('replays the same stream for the same seed', () => {
    const r = new Rng(0)
    expect(r.random()).toBe(0.8444218515250481)
    expect(r.uniform(0, 2 * Math.PI)).toBe(4.7623679680665845)
    expect(r.gauss(0, 0.1)).toBe(-0.0679714448078421)
    expect(r.gauss(0, 0.1)).toBe(0.037050356746065986)
  })

  it('gives different streams for different seeds', () => {
    expect(new Rng(1).random()).not.toBe(new Rng(2).random())
    expect(new Rng(20260924).random()).toBe(0.015269777323472566)
  })

  it('draws uniform floats in [0, 1) and unit gaussians', () => {
    const r = new Rng(42)
    let lo = 1
    let hi = 0
    let sum = 0
    let g = 0
    let g2 = 0
    const n = 20000
    for (let i = 0; i < n; i++) {
      const u = r.random()
      lo = Math.min(lo, u)
      hi = Math.max(hi, u)
      sum += u
      const z = r.gauss(0, 1)
      g += z
      g2 += z * z
    }
    expect(lo).toBeGreaterThanOrEqual(0)
    expect(hi).toBeLessThan(1)
    expect(sum / n).toBeCloseTo(0.5, 1)
    expect(g / n).toBeCloseTo(0, 1)
    expect(Math.sqrt(g2 / n)).toBeCloseTo(1, 1)
  })
})
