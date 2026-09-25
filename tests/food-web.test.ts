import { describe, expect, it } from 'vitest'
import { STABLE_PRESET } from '@/game/presets'
import { SENSE } from '@/sim/brain'
import { deriveParams } from '@/sim/levers'
import { SCENARIO_BY_ID, SCENARIOS } from '@/sim/scenarios'
import { Sim, type Creature } from '@/sim/sim'
import { FOOD_WEB, THREE_SPECIES, speciesList } from '@/sim/species'

/**
 * A Vole meadow with animals that stand still (step 0) and no sprouting, reduced to one
 * rabbit, one fox and one vole, all fed and parked out of each other's reach. Each test
 * then places the animals it needs.
 */
function meadow(seed = 11, still = true, coverSlow?: number) {
  const p = deriveParams(STABLE_PRESET, THREE_SPECIES)
  // These tests measure the species' base bodies; inherited body size has its own tests (body.test.ts).
  p.eco.body = undefined
  if (still) for (const body of [p.prey, p.pred, p.vole!.body]) body.step = 0
  if (coverSlow !== undefined) p.eco.coverSlow = coverSlow
  p.sproutPerDay = 0
  const s = new Sim(p, seed)
  const rabbit = s.prey[0]
  const fox = s.preds[0]
  const vole = s.voles[0]
  s.pops.prey = [rabbit]
  s.pops.pred = [fox]
  s.pops.vole = [vole]
  const park = (a: Creature, x: number, y: number) => {
    a.x = x
    a.y = y
    a.inCover = s.inCover(x, y)
    a.energy = s.defs[a.species].body.maxEnergy
  }
  park(rabbit, 0.001, 0.001)
  park(fox, 0.999, 0.001)
  park(vole, 0.001, 0.999)
  return { p, s, rabbit, fox, vole, park }
}

/** A point at `d` from a tall-grass patch centre, away from every bush's feeding reach. */
function coverSpot(s: Sim) {
  const k = s.cover.findIndex(([x, y]) => s.bushes.every(b => Math.hypot(b.x - x, b.y - y) > 0.1))
  expect(k).toBeGreaterThanOrEqual(0)
  return { k, x: s.cover[k][0], y: s.cover[k][1] }
}

function openBush(s: Sim) {
  const b = s.bushes.find(b => !s.inCover(b.x, b.y))!
  expect(b).toBeDefined()
  return b
}

describe('food web table', () => {
  it('rabbits and voles eat plants, foxes eat rabbits and voles, and nobody else hunts', () => {
    const { s } = meadow()
    expect(s.species).toEqual(['prey', 'pred', 'vole'])
    expect(s.defs.prey.diet.map(d => d.food)).toEqual(['berries'])
    expect(s.defs.vole.diet.map(d => d.food)).toEqual(['seed', 'berries'])
    expect(s.defs.pred.diet).toEqual([])
    expect(s.defs.pred.eats).toEqual(['prey', 'vole'])
    expect(s.defs.prey.eats).toEqual([])
    expect(s.defs.vole.eats).toEqual([])
    expect(FOOD_WEB.vole.coverSlows).toBe(false)
  })

  it('keeps the Open meadow at two species, with foxes eating only rabbits', () => {
    const p = deriveParams(STABLE_PRESET)
    expect(p.vole).toBeUndefined()
    expect(speciesList(p)).toEqual(['prey', 'pred'])
    const s = new Sim(p, 3)
    expect(s.defs.pred.eats).toEqual(['prey'])
    expect(s.voles).toEqual([])
    expect(s.grassSeed).toEqual([])
  })
})

describe('feeding and energy transfer', () => {
  it('a hungry vole in tall grass eats one bite of seed worth its meal energy', () => {
    const run = (seed: number) => {
      const { s, vole } = meadow()
      const { k, x, y } = coverSpot(s)
      vole.x = x
      vole.y = y
      vole.inCover = true
      vole.energy = 30
      s.grassSeed[k] = seed
      s.step()
      return { s, k, vole }
    }
    const fed = run(20)
    const unfed = run(0)
    expect(fed.s.grassSeed[fed.k]).toBeCloseTo(20 - 0.4, 12)
    expect(fed.vole.energy - unfed.vole.energy).toBeCloseTo(14, 10)
    expect(fed.vole.meals).toBe(1)
    expect(unfed.vole.meals).toBe(0)
  })

  it('a vole at a bush gains a quarter of a seed bite and takes 0.4 berry', () => {
    const run = (stock: number) => {
      const { s, vole } = meadow()
      const b = openBush(s)
      b.stock = stock
      vole.x = b.x
      vole.y = b.y
      vole.inCover = false
      vole.energy = 30
      s.step()
      return { b, vole }
    }
    const fed = run(30)
    const unfed = run(0)
    expect(fed.b.stock).toBeCloseTo(29.6, 12)
    expect(fed.vole.energy - unfed.vole.energy).toBeCloseTo(14 * 0.25, 10)
  })

  it('a full vole does not eat', () => {
    const { s, vole } = meadow()
    const { k, x, y } = coverSpot(s)
    vole.x = x
    vole.y = y
    vole.inCover = true
    s.step()
    expect(s.grassSeed[k]).toBe(20)
    expect(vole.meals).toBe(0)
  })

  it('rabbits cannot eat grass seed', () => {
    const { s, rabbit } = meadow()
    const { k, x, y } = coverSpot(s)
    rabbit.x = x
    rabbit.y = y
    rabbit.inCover = true
    rabbit.energy = 20
    const before = rabbit.energy
    s.step()
    expect(s.grassSeed[k]).toBe(20)
    expect(rabbit.meals).toBe(0)
    expect(rabbit.energy).toBeLessThan(before)
  })

  it('foxes cannot eat grass seed or berries', () => {
    const { s, fox } = meadow()
    const { k, x, y } = coverSpot(s)
    fox.x = x
    fox.y = y
    fox.inCover = true
    fox.energy = 20
    s.step()
    expect(s.grassSeed[k]).toBe(20)
    const b = openBush(s)
    const stock = b.stock
    fox.x = b.x
    fox.y = b.y
    s.step()
    expect(b.stock).toBeGreaterThanOrEqual(stock)
    expect(fox.meals).toBe(0)
  })

  it('a rabbit still takes a whole berry at full value', () => {
    const run = (stock: number) => {
      const { s, rabbit } = meadow()
      const b = openBush(s)
      b.stock = stock
      rabbit.x = b.x
      rabbit.y = b.y
      rabbit.energy = 50
      s.step()
      return { b, rabbit, p: s.p }
    }
    const fed = run(30)
    const unfed = run(0)
    expect(fed.b.stock).toBe(29)
    expect(fed.rabbit.energy - unfed.rabbit.energy).toBeCloseTo(fed.p.prey.mealEnergy, 10)
  })

  it('a hungry fox catching a vole gains 40% of its meal, counted as a vole eaten', () => {
    const run = (catchIt: boolean) => {
      const { s, fox, vole, p } = meadow()
      const spot = openBush(s)
      fox.x = spot.x
      fox.y = spot.y
      fox.inCover = false
      fox.energy = p.pred.maxEnergy / 2
      if (catchIt) {
        vole.x = fox.x
        vole.y = fox.y
        vole.inCover = fox.inCover
      }
      s.step()
      return { s, fox, vole, p }
    }
    const hunt = run(true)
    const miss = run(false)
    expect(hunt.s.voles.includes(hunt.vole)).toBe(false)
    expect(hunt.fox.energy - miss.fox.energy).toBeCloseTo(0.4 * hunt.p.pred.mealEnergy, 10)
    expect(hunt.s.tally.vole.eaten).toBe(1)
    expect(hunt.s.tally.prey.eaten).toBe(0)
    expect(hunt.s.counters.preyEaten).toBe(0)
  })

  it('voles do not eat rabbits', () => {
    const { s, rabbit, vole } = meadow()
    vole.x = rabbit.x
    vole.y = rabbit.y
    vole.energy = 10
    s.step()
    expect(s.prey.includes(rabbit)).toBe(true)
    expect(s.tally.prey.eaten).toBe(0)
    expect(vole.meals).toBe(0)
  })
})

describe('senses and refuge', () => {
  const sense = (s: Sim, a: Creature) => {
    const grids = s['grids']
    for (const sp of s.species) grids[sp].build(s.pops[sp])
    s['sense'](a)
    return s['x']
  }

  it('voles sense foxes as threats and foxes sense voles as food', () => {
    const { s, fox, vole } = meadow()
    s.pops.prey = []
    const b = openBush(s)
    fox.x = b.x
    fox.y = b.y
    vole.x = b.x + 0.05
    vole.y = b.y
    vole.inCover = s.inCover(vole.x, vole.y)
    expect(vole.inCover).toBe(false)
    expect(sense(s, vole)[SENSE.threat1 + 2]).toBeGreaterThan(0)
    const x = sense(s, fox)
    expect(x[SENSE.food1 + 2]).toBeGreaterThan(0)
    expect(x[SENSE.foodAmount]).toBeCloseTo(0.1, 12)
  })

  it('voles sense grass seed as food; rabbits do not', () => {
    const { s, rabbit, vole } = meadow()
    s.bushes = []
    const { x, y } = coverSpot(s)
    for (const a of [rabbit, vole]) {
      a.x = x + 0.1
      a.y = y
    }
    expect(sense(s, vole)[SENSE.food1 + 2]).toBeGreaterThan(0)
    expect(sense(s, vole)[SENSE.foodAmount]).toBe(1)
    expect(sense(s, rabbit)[SENSE.food1 + 2]).toBe(0)
  })

  it('tall grass hides a vole from a fox beyond cover sight', () => {
    const { s, fox, vole, p } = meadow()
    s.pops.prey = []
    const { x, y } = coverSpot(s)
    vole.x = x
    vole.y = y
    vole.inCover = true
    fox.x = x + p.eco.coverSight + 0.01
    fox.y = y
    expect(fox.view).toBeGreaterThan(0.06)
    expect(sense(s, fox)[SENSE.food1 + 2]).toBe(0)
    fox.x = x + p.eco.coverSight - 0.01
    expect(sense(s, fox)[SENSE.food1 + 2]).toBeGreaterThan(0)
  })

  it('tall grass does not slow voles, but still slows rabbits', () => {
    const run = (slow: number) => {
      const { s, rabbit, vole } = meadow(12, false, slow)
      const { x, y } = coverSpot(s)
      for (const a of [vole, rabbit]) {
        a.x = x
        a.y = y
        a.inCover = true
      }
      s.step()
      return { vole: Math.hypot(vole.x - x, vole.y - y), rabbit: Math.hypot(rabbit.x - x, rabbit.y - y) }
    }
    const slowed = run(0.01)
    const free = run(1)
    expect(free.vole).toBeGreaterThan(0)
    expect(slowed.vole).toBeCloseTo(free.vole, 12)
    expect(free.rabbit).toBeGreaterThan(0)
    expect(slowed.rabbit / free.rabbit).toBeCloseTo(0.01, 9)
  })
})

describe('death attribution', () => {
  it('counts vole deaths by cause and never in rabbit or fox counters', () => {
    const { s, vole, park } = meadow()
    const more = s.voles.concat()
    const starve = vole
    starve.energy = 0.001
    const oldOne = Object.assign(Object.create(Object.getPrototypeOf(vole)), vole, { id: 9001 }) as Creature
    park(oldOne, 0.002, 0.998)
    oldOne.age = s.p.vole!.body.lifespan
    const ill = Object.assign(Object.create(Object.getPrototypeOf(vole)), vole, { id: 9002 }) as Creature
    park(ill, 0.003, 0.997)
    ill.energy = 0.001
    ill.illUntil = 100
    const alive = Object.assign(Object.create(Object.getPrototypeOf(vole)), vole, { id: 9003 }) as Creature
    park(alive, 0.004, 0.996)
    s.pops.vole = [...more, oldOne, ill, alive]
    s.step()
    expect(s.tally.vole).toMatchObject({ starved: 1, old: 1, illness: 1, eaten: 0 })
    expect(s.counters).toMatchObject({ preyStarved: 0, preyOld: 0, preyIllness: 0, preyEaten: 0, predStarved: 0, predIllness: 0 })
    expect(s.voles).toEqual([alive])
  })

  it('ends the run when voles die out, and a year counts only with all three alive', () => {
    const { s, vole } = meadow()
    vole.energy = 0.001
    expect(s.step()).toBe(false)
    expect(s.ended).toBe(true)
    expect(s.survived).toBe(false)
  })
})

describe('vole actions', () => {
  it('releases twelve voles into tall grass and starts vole illness only in voles', () => {
    const s = new Sim(deriveParams(STABLE_PRESET, THREE_SPECIES), 21)
    s.step()
    const before = s.voles.length
    s.queue('releaseVole')
    s.queue('illnessVole')
    s.step()
    // Released at the start of the hour, then aged and moved once like everyone else.
    const released = s.voles.filter(a => a.age === 1 && a.parent >= 0)
    expect(released.length).toBe(12)
    const reach = s.p.eco.coverR + s.p.vole!.body.step + 1e-9
    for (const a of released) expect(s.cover.some(([x, y]) => Math.hypot(a.x - x, a.y - y) <= reach)).toBe(true)
    expect(s.voles.length).toBeGreaterThan(before)
    expect(s.voles.filter(a => a.illUntil > s.tick).length).toBeGreaterThan(0)
    expect(s.prey.every(a => a.illUntil === 0) && s.preds.every(a => a.illUntil === 0)).toBe(true)
  })

  it('vole actions do nothing in a two-species meadow', () => {
    const a = new Sim(deriveParams(STABLE_PRESET), 22)
    const b = new Sim(deriveParams(STABLE_PRESET), 22)
    b.queue('releaseVole')
    b.queue('illnessVole')
    for (let i = 0; i < 30; i++) { a.step(); b.step() }
    const { pending: _a, ...sa } = a.save()
    const { pending: _b, ...sb } = b.save()
    expect(sb).toEqual(sa)
  })
})

describe('Vole meadow scenario', () => {
  it('is offered last in the picker; the other meadows stay two-species and the Open meadow comes first', () => {
    expect(SCENARIOS.map(s => s.id)).toEqual(['stable', 'drought', 'invasion', 'winter', 'voles'])
    expect(SCENARIO_BY_ID.voles.species).toEqual(['prey', 'pred', 'vole'])
    for (const s of SCENARIOS.filter(s => s.id !== 'voles')) expect(s.species).toEqual(['prey', 'pred'])
  })
})
