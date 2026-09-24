import { describe, expect, it } from 'vitest'
import { STABLE_PRESET } from '@/game/presets'
import { benchmarkLevers, BUDGET, deriveParams, LEVERS, spent } from '@/sim/levers'
import { benchmarkParams } from '@/sim/params'
import { SCENARIO_BY_ID } from '@/sim/scenarios'
import { runHeadless, Sim } from '@/sim/sim'
import { calendar, formatDuration, formatHours, tickAt } from '@/sim/time'

describe('natural time labels', () => {
  it('maps the 8,000-tick horizon to 11 months 3 days', () => {
    expect(formatDuration(8000)).toBe('11 months 3 days')
    expect(formatDuration(100)).toBe('4 days 4 hours')
    expect(formatHours(150)).toBe('6 d 6 h')
    expect(formatHours(15)).toBe('15 h')
  })
  it('starts on 1 September and puts winter in December to February', () => {
    expect(calendar(0)).toMatchObject({ day: 1, monthName: 'Sep', hour: 8, season: 'autumn' })
    expect(calendar(tickAt(3))).toMatchObject({ day: 1, monthName: 'Dec', hour: 0, season: 'winter' })
    expect(calendar(tickAt(6) - 1).monthName).toBe('Feb')
    expect(calendar(8000)).toMatchObject({ monthName: 'Jul', day: 31, hour: 16 })
  })
})

describe('levers', () => {
  it('benchmark levers derive the exact benchmark params under classic rules', () => {
    expect(deriveParams(benchmarkLevers(), 'classic')).toEqual(benchmarkParams())
  })
  it('every lever value sits on its own step grid, for both presets', () => {
    for (const preset of [benchmarkLevers(), STABLE_PRESET]) {
      for (const d of LEVERS) {
        const v = preset[d.id]
        expect(v, d.id).toBeGreaterThanOrEqual(d.min)
        expect(v, d.id).toBeLessThanOrEqual(d.max)
        const k = (v - d.min) / d.step
        expect(Math.abs(k - Math.round(k)), d.id).toBeLessThan(1e-6)
      }
    }
  })
  it('charges boosts in full, refunds half, and stops maxing everything', () => {
    const maxed = { ...STABLE_PRESET }
    for (const d of LEVERS) if (d.boost !== 0) maxed[d.id] = d.boost > 0 ? d.max : d.min
    expect(spent(maxed, STABLE_PRESET, 'energy')).toBeGreaterThan(BUDGET * 5)
    const v = { ...STABLE_PRESET, 'food.patches': STABLE_PRESET['food.patches'] + 1 }
    expect(spent(v, STABLE_PRESET, 'energy')).toBe(2)
    const w = { ...STABLE_PRESET, 'food.patches': STABLE_PRESET['food.patches'] - 1 }
    expect(spent(w, STABLE_PRESET, 'energy')).toBe(-1)
  })
  it('bigger litters lengthen the birth gap', () => {
    const p = deriveParams({ ...STABLE_PRESET, 'prey.litter': 3 }, 'energy')
    expect(p.prey.birthGap).toBe(STABLE_PRESET['prey.birthGap'] * 2)
  })
})

describe('energy rules', () => {
  it('are deterministic for a seed', () => {
    const p = deriveParams(STABLE_PRESET, 'energy')
    const a = new Sim(p, 3)
    const b = new Sim(p, 3)
    for (let i = 0; i < 500; i++) {
      a.step()
      b.step()
    }
    expect(a.prey.map((x) => [x.x, x.y, x.energy])).toEqual(b.prey.map((x) => [x.x, x.y, x.energy]))
  })
  it('keep one step per tick and cap every step at max speed', () => {
    const p = deriveParams(STABLE_PRESET, 'energy')
    const s = new Sim(p, 1)
    for (let i = 0; i < 300; i++) {
      const before = new Map(s.prey.map((a) => [a.id, [a.x, a.y]]))
      s.step()
      for (const a of s.prey) {
        const prev = before.get(a.id)
        if (!prev) continue
        expect(Math.hypot(a.x - prev[0], a.y - prev[1])).toBeLessThanOrEqual(p.prey.step + 1e-12)
      }
    }
  })
  it('charge a sprint more than a cruise, quadratically', () => {
    const p = deriveParams(STABLE_PRESET, 'energy')
    const sp = p.pred
    const cost = (pace: number) => sp.speedCost * ((sp.step * pace) / sp.baseStep) ** 2
    expect(cost(1) / cost(0.5)).toBeCloseTo(4)
  })
  it('scenario disturbances do not touch the animal random stream before they start', () => {
    const p = deriveParams(STABLE_PRESET, 'energy')
    const plain = new Sim(p, 5)
    const winter = new Sim(p, 5, SCENARIO_BY_ID.winter.disturbance)
    for (let i = 0; i < tickAt(3) - 1; i++) {
      plain.step()
      winter.step()
    }
    expect(winter.prey.length).toBe(plain.prey.length)
    expect(winter.preds.map((a) => a.energy)).toEqual(plain.preds.map((a) => a.energy))
  })
})

describe('stable preset', () => {
  it('reaches 8,000 ticks on at least 7 of seeds 0-9', () => {
    const p = deriveParams(STABLE_PRESET, 'energy')
    const runs = Array.from({ length: 10 }, (_, s) => runHeadless(p, s))
    expect(runs.filter((r) => r.survived).length).toBeGreaterThanOrEqual(7)
  }, 60_000)
})
