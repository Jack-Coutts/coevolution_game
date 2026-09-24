import { describe, expect, it } from 'vitest'
import { STABLE_PRESET } from '@/game/presets'
import { scoreRun } from '@/game/scores'
import { BUDGET, deriveParams, LEVERS, spent } from '@/sim/levers'
import { grow, N_IN, N_OUT, randomGenome, think } from '@/sim/brain'
import { Rng } from '@/sim/rng'
import { SCENARIO_BY_ID } from '@/sim/scenarios'
import { runHeadless, Sim } from '@/sim/sim'
import { calendar, formatDuration, formatHours, tickAt } from '@/sim/time'

describe('natural time labels', () => {
  it('formats durations through and beyond the 365-day challenge', () => {
    expect(formatDuration(8000)).toBe('11 months 3 days')
    expect(formatDuration(8760)).toBe('1 year')
    expect(formatDuration(8784)).toBe('1 year 1 day')
    expect(formatDuration(100)).toBe('4 days 4 hours')
    expect(formatHours(150)).toBe('6 d 6 h')
    expect(formatHours(15)).toBe('15 h')
  })
  it('starts on 1 September and puts winter in December to February', () => {
    expect(calendar(0)).toMatchObject({ day: 1, monthName: 'Sep', hour: 8, season: 'autumn' })
    expect(calendar(tickAt(3))).toMatchObject({ day: 1, monthName: 'Dec', hour: 0, season: 'winter' })
    expect(calendar(tickAt(6) - 1).monthName).toBe('Feb')
    expect(calendar(8760)).toMatchObject({ monthName: 'Sep', day: 1, hour: 8 })
  })
})

describe('levers', () => {
  it('every preset value sits on its lever grid', () => {
    for (const d of LEVERS) {
      const v = STABLE_PRESET[d.id]
      expect(v, d.id).toBeGreaterThanOrEqual(d.min)
      expect(v, d.id).toBeLessThanOrEqual(d.max)
      const k = (v - d.min) / d.step
      expect(Math.abs(k - Math.round(k)), d.id).toBeLessThan(1e-6)
    }
  })
  it('charges boosts in full, refunds half, and stops maxing everything', () => {
    const maxed = { ...STABLE_PRESET }
    for (const d of LEVERS) if (d.boost !== 0) maxed[d.id] = d.boost > 0 ? d.max : d.min
    expect(spent(maxed, STABLE_PRESET)).toBeGreaterThan(BUDGET * 5)
    const v = { ...STABLE_PRESET, 'food.patches': STABLE_PRESET['food.patches'] + 1 }
    expect(spent(v, STABLE_PRESET)).toBe(2)
    const w = { ...STABLE_PRESET, 'food.patches': STABLE_PRESET['food.patches'] - 1 }
    expect(spent(w, STABLE_PRESET)).toBe(-1)
  })
  it('bigger litters lengthen the birth gap', () => {
    const p = deriveParams({ ...STABLE_PRESET, 'prey.litter': 3 })
    expect(p.prey.birthGap).toBe(STABLE_PRESET['prey.birthGap'] * 2)
  })
})

describe('simulation', () => {
  const p = deriveParams(STABLE_PRESET)

  it('replays a seed exactly', () => {
    const a = runHeadless(p, 7)
    const b = runHeadless(p, 7)
    expect(b).toEqual(a)
    const s1 = new Sim(p, 3)
    const s2 = new Sim(p, 3)
    for (let i = 0; i < 300; i++) {
      s1.step()
      s2.step()
    }
    expect(s2.prey.map((x) => [x.x, x.y, x.energy])).toEqual(s1.prey.map((x) => [x.x, x.y, x.energy]))
  })

  it('moves every animal once per hour, never faster than its max speed', () => {
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

  it('catches a rabbit in physical reach after movement', () => {
    const params = structuredClone(p)
    params.prey.step = 0
    params.pred.step = 0
    const s = new Sim(params, 4)
    const fox = s.preds[0]
    const rabbit = s.prey[0]
    fox.x = 0.4
    fox.y = 0.4
    rabbit.x = 0.4
    rabbit.y = 0.4
    s.step()
    expect(s.prey.includes(rabbit)).toBe(false)
    expect(s.counters.preyEaten).toBeGreaterThanOrEqual(1)
  })

  it('kills an animal whose energy runs out', () => {
    const s = new Sim(p, 2)
    const victim = s.prey[0]
    victim.energy = 0.01
    s.step()
    expect(s.prey.includes(victim)).toBe(false)
    expect(s.counters.preyStarved).toBe(1)
  })

  it('limits births with a performance ceiling, not a population lever', () => {
    expect(LEVERS.some((d) => d.id.endsWith('.cap'))).toBe(false)
    const s = new Sim(p, 4)
    expect(s.cap('prey')).toBeGreaterThan(400)
    expect(s.cap('pred')).toBeGreaterThan(200)
    for (let i = 0; i < 200; i++) s.step()
    expect(s.prey.length).toBeLessThan(s.cap('prey'))
    expect(s.preds.length).toBeLessThan(s.cap('pred'))
  })

  it('lets a fed adult breed, paying the child energy into the newborn', () => {
    const s = new Sim(p, 2)
    const parent = s.prey[0]
    parent.age = p.prey.adultAge
    parent.energy = p.prey.maxEnergy
    const before = s.counters.preyBorn
    s.step()
    const born = s.counters.preyBorn - before
    expect(born).toBeGreaterThanOrEqual(1)
    const child = s.prey.find((a) => a.age === 0 && Math.hypot(a.x - parent.x, a.y - parent.y) <= p.birthR + p.prey.step)
    expect(child?.energy).toBe(p.prey.childEnergy * p.prey.maxEnergy)
    expect(parent.lastBirth).toBe(parent.age)
  })

  it('leaves the animals untouched by a scenario until its disturbance starts', () => {
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

describe('score', () => {
  it('pays bonuses only for a full year, capped so weakening levers cannot inflate them', () => {
    expect(scoreRun(5000, false, 0, 0)).toEqual({ hours: 5000, budgetBonus: 0, calmBonus: 0, total: 5000 })
    expect(scoreRun(8760, true, 0, 0)).toEqual({ hours: 8760, budgetBonus: 300, calmBonus: 400, total: 9460 })
    expect(scoreRun(8760, true, -12, 0).total).toBe(9460)
    expect(scoreRun(8760, true, 20, 2)).toEqual({ hours: 8760, budgetBonus: 100, calmBonus: 200, total: 9060 })
    expect(scoreRun(8760, true, 35, 4).total).toBe(8760)
  })
})

describe('brains', () => {
  it('grow a neuron without changing what the brain does', () => {
    const rng = new Rng(9)
    const g = randomGenome(rng, 3, 1)
    const grown = grow(rng, g, 0.1)
    const x = new Float64Array(N_IN).map((_, i) => Math.sin(i * 1.7))
    const out = (genome: typeof g) => {
      const o = new Float64Array(N_OUT)
      think(genome, x, new Float64Array(16), o)
      return [...o]
    }
    expect(grown.nHid).toBe(4)
    expect(out(grown)).toEqual(out(g))
  })
})

describe('hunting', () => {
  it('lets a satiated fox leave a rabbit alive until it needs energy', () => {
    const p = deriveParams(STABLE_PRESET)
    p.prey.step = 0
    p.pred.step = 0
    const s = new Sim(p, 4)
    const fox = s.preds[0]
    s.pops.pred = [fox]
    fox.energy = p.pred.maxEnergy
    const rabbit = s.prey[0]
    rabbit.x = fox.x + p.eatR * 0.9
    rabbit.y = fox.y
    const eaten = s.counters.preyEaten
    s.step()
    expect(s.prey.includes(rabbit)).toBe(true)
    expect(s.counters.preyEaten - eaten).toBe(0)
    fox.energy = p.pred.maxEnergy / 2
    s.step()
    expect(s.prey.includes(rabbit)).toBe(false)
  })
})

describe('food', () => {
  it('withers a bush that stays grazed down for the wither time', () => {
    const p = deriveParams(STABLE_PRESET)
    p.regrowEvery = 1e9
    p.sproutPerDay = 0
    const s = new Sim(p, 6)
    const bush = s.bushes[0]
    bush.stock = 0
    for (let t = 1; t < p.witherHours; t++) s.step()
    expect(s.bushes.includes(bush)).toBe(true)
    s.step()
    expect(s.bushes.includes(bush)).toBe(false)
  })

  it('sprouts new bushes at the same places for the same seed', () => {
    const p = deriveParams(STABLE_PRESET)
    p.sproutPerDay = 24
    const run = () => {
      const s = new Sim(p, 8)
      for (let t = 0; t < 72; t++) s.step()
      return s.bushes.map((b) => [b.id, b.x, b.y])
    }
    const a = run()
    expect(a.length).toBeGreaterThan(p.patches)
    expect(run()).toEqual(a)
  })
})
