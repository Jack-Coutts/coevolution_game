import { describe, expect, it } from 'vitest'
import { HISTORY_HOURS } from '@/game/history'
import { actionsFor, optionCount } from '@/game/interventions'
import { STABLE_PRESET } from '@/game/presets'
import { migrateSave, type MeadowSave } from '@/game/saves'
import { summarizeEvolution } from '@/sim/evolution'
import { deriveParams, leversFor } from '@/sim/levers'
import { SCENARIO_BY_ID, SCENARIOS } from '@/sim/scenarios'
import { EFFECTS, Sim, type Creature, type Intervention } from '@/sim/sim'
import { FIVE_SPECIES, THREE_SPECIES, TWO_SPECIES, type Species } from '@/sim/species'
import { frame, writeStats } from '@/worker/pack'
import { STAT, STAT_STRIDE, STAT_STRIDE_V3 } from '@/worker/protocol'

const wildParams = () => deriveParams(STABLE_PRESET, SCENARIO_BY_ID.wild.species)

/** A Wild meadow of still animals (step 0), one of each, fed and parked in the corners; no sprouting. */
function meadow(seed = 11) {
  const p = wildParams()
  p.eco.body = undefined
  for (const body of [p.prey, p.pred, p.vole!.body, p.stoat!.body, p.deer!.body]) body.step = 0
  p.sproutPerDay = 0
  const s = new Sim(p, seed)
  const one = {} as Record<Species, Creature>
  for (const sp of FIVE_SPECIES) {
    one[sp] = s.pops[sp][0]
    s.pops[sp] = [one[sp]]
  }
  const park = (a: Creature, x: number, y: number, energy = s.defs[a.species].body.maxEnergy) => {
    a.x = x
    a.y = y
    a.inCover = s.inCover(x, y)
    a.energy = energy
  }
  const corners: [number, number][] = [[0.001, 0.001], [0.999, 0.001], [0.001, 0.999], [0.999, 0.999], [0.5, 0.001]]
  FIVE_SPECIES.forEach((sp, i) => park(one[sp], ...corners[i]))
  return { s, one, park }
}

/** A tall-grass patch centre away from every bush. */
function coverSpot(s: Sim) {
  const k = s.cover.findIndex(([x, y]) => s.bushes.every(b => Math.hypot(b.x - x, b.y - y) > 0.1))
  expect(k).toBeGreaterThanOrEqual(0)
  return { k, x: s.cover[k][0], y: s.cover[k][1] }
}

describe('Wild meadow food web', () => {
  it('seed to voles to stoats to foxes, deer on berries and seed, and nothing hunts deer', () => {
    const { s } = meadow()
    expect(s.species).toEqual(['prey', 'pred', 'vole', 'stoat', 'deer'])
    expect(s.defs.deer.diet.map(d => [d.food, d.bite, d.value])).toEqual([['berries', 2, 1], ['seed', 1, 0.4]])
    expect(s.defs.deer.eats).toEqual([])
    expect(s.defs.stoat.diet).toEqual([])
    expect(s.defs.stoat.eats).toEqual(['vole', 'prey'])
    expect(s.defs.stoat.young).toEqual(['prey'])
    expect(s.defs.pred.eats).toEqual(['prey', 'vole', 'stoat'])
    expect(s.defs.pred.young).toEqual([])
    expect(s.defs.vole.eats).toEqual([])
    expect(s.defs.prey.eats).toEqual([])
    for (const sp of FIVE_SPECIES) expect(s.defs[sp].eats).not.toContain('deer')
    expect([s.defs.stoat.coverSlows, s.defs.deer.coverSlows]).toEqual([false, true])
    expect([s.defs.stoat.coverSight, s.defs.pred.coverSight]).toEqual([0.04, 0.04])
  })

  it('leaves the Open and Vole meadows without stoats or deer', () => {
    const open = new Sim(deriveParams(STABLE_PRESET), 3)
    const vole = new Sim(deriveParams(STABLE_PRESET, THREE_SPECIES), 3)
    expect(open.species).toEqual(['prey', 'pred'])
    expect(vole.species).toEqual(['prey', 'pred', 'vole'])
    expect(open.defs.pred.eats).toEqual(['prey'])
    expect(vole.defs.pred.eats).toEqual(['prey', 'vole'])
    expect([vole.pops.stoat, vole.pops.deer]).toEqual([[], []])
  })

  it('a hungry stoat catches a vole hiding in tall grass and gains 40 energy', () => {
    const run = (near: boolean) => {
      const { s, one, park } = meadow()
      const { x, y } = coverSpot(s)
      park(one.vole, x, y)
      park(one.stoat, near ? x + 0.001 : 0.999, near ? y : 0.5, 30)
      s.step()
      return { s, stoat: one.stoat }
    }
    const hit = run(true)
    const miss = run(false)
    expect(hit.s.pops.vole.length).toBe(0)
    expect(miss.s.pops.vole.length).toBe(1)
    expect(hit.stoat.energy - miss.stoat.energy).toBeCloseTo(40, 10)
    expect(hit.s.tally.vole.eaten).toBe(1)
  })

  it('a stoat takes a young rabbit but not an adult one', () => {
    const run = (age: number) => {
      const { s, one, park } = meadow()
      park(one.prey, 0.3, 0.3, 20)
      one.prey.age = age
      park(one.stoat, 0.301, 0.3, 5)
      s.step()
      return { rabbits: s.pops.prey.length, energy: one.stoat.energy }
    }
    const kit = run(10)
    const adult = run(500)
    expect(kit.rabbits).toBe(0)
    expect(adult.rabbits).toBe(1)
    expect(kit.energy - adult.energy).toBeCloseTo(100, 10)
  })

  it('a fox must come within 0.3 of its usual reach to catch a stoat, and gains 18 energy', () => {
    const run = (gap: number) => {
      const { s, one, park } = meadow()
      park(one.stoat, 0.3, 0.3)
      park(one.pred, 0.3 + gap, 0.3, 50)
      s.step()
      return { stoats: s.pops.stoat.length, energy: one.pred.energy }
    }
    const far = run(0.004)
    const near = run(0.001)
    expect(far.stoats).toBe(1)
    expect(near.stoats).toBe(0)
    expect(near.energy - far.energy).toBeCloseTo(18, 10)
  })

  it('a deer browses two berries per bite from a bush beyond a rabbit\'s reach', () => {
    const run = (stock: number) => {
      const { s, one, park } = meadow()
      const b = s.bushes.find(b => !s.inCover(b.x + 0.04, b.y) && b.x < 0.9)!
      b.stock = stock
      park(one.deer, b.x + 0.04, b.y, 100)
      s.step()
      return { b, deer: one.deer }
    }
    const fed = run(30)
    const unfed = run(0)
    expect(fed.b.stock).toBe(28)
    expect(fed.deer.energy - unfed.deer.energy).toBeCloseTo(60, 10)
  })

  it('a deer in tall grass with no bush in reach eats one seed head worth 24 energy', () => {
    const { s, one, park } = meadow()
    const { k, x, y } = coverSpot(s)
    s.grassSeed[k] = 10
    park(one.deer, x, y, 100)
    const before = one.deer.energy
    s.step()
    expect(s.grassSeed[k]).toBe(9)
    const upkeep = one.deer.metabolism + s.defs.deer.body.visionUpkeep * one.deer.view + s.p.eco.brainUpkeep * one.deer.brain.nHid
    expect(one.deer.energy - before + upkeep).toBeCloseTo(24, 10)
  })
})

describe('new interventions', () => {
  const act = (action: Intervention, p = wildParams(), seed = 7) => {
    const s = new Sim(p, seed, undefined, { record: true })
    for (let i = 0; i < 50; i++) s.step()
    const before = { cover: s.cover.length, seed: [...s.grassSeed], pops: Object.fromEntries(s.species.map(sp => [sp, s.pops[sp].length])), bushes: s.bushes.length }
    s.queue(action)
    s.step()
    return { s, before }
  }

  it('mowing cuts half the tall grass for 30 days and loses its seed', () => {
    const { s, before } = act('mow')
    expect(before.cover).toBe(8)
    expect(s.cover.length).toBe(4)
    expect(s.grassSeed.length).toBe(4)
    expect(s.mown.map(m => m.until)).toEqual([771, 771, 771, 771])
    expect(frame(s).cover!.length).toBe(8)
    for (const a of s.pops.prey) expect(a.inCover).toBe(s.inCover(a.x, a.y))
    while (s.tick < 770) s.step()
    expect(s.cover.length).toBe(4)
    s.step()
    expect(s.cover.length).toBe(8)
    expect(s.mown).toEqual([])
    expect(s.grassSeed.slice(4)).toEqual([0, 0, 0, 0])
  })

  it('mowing works in the Open meadow too, where there is no seed', () => {
    const { s } = act('mow', deriveParams(STABLE_PRESET))
    expect([s.cover.length, s.grassSeed.length, s.mown.length]).toEqual([4, 0, 4])
  })

  it('sowing adds two tall-grass patches that start with no seed', () => {
    const { s, before } = act('sow')
    expect(s.cover.length).toBe(before.cover + 2)
    expect(s.grassSeed.slice(-2)).toEqual([0, 0])
    const row = new Float64Array(STAT_STRIDE)
    writeStats(s, row, 0)
    expect(row[STAT.cover]).toBe(10)
  })

  it('hay puts out four piles for ten days that are not counted as bushes', () => {
    const { s, before } = act('hay')
    expect(s.bushes.length).toBe(before.bushes + 4)
    const f = frame(s)
    expect(f.hay!.length).toBe(4 * 5)
    expect(f.bushes.length / 6).toBe(before.bushes)
    const row = new Float64Array(STAT_STRIDE)
    writeStats(s, row, 0)
    expect([row[STAT.hay], row[STAT.bushes]]).toEqual([4, before.bushes])
    while (s.tick < 51 + EFFECTS.hay.hours - 1) s.step()
    expect(s.bushes.filter(b => b.hay !== undefined).length).toBe(4)
    s.step()
    expect(s.bushes.filter(b => b.hay !== undefined).length).toBe(0)
    expect(frame(s).hay).toBeUndefined()
  })

  it('a hungry rabbit eats from a hay pile', () => {
    const { s, one, park } = meadow()
    s.bushes = []
    s.queue('hay')
    s.step()
    const pile = s.bushes[0]
    park(one.prey, pile.x, pile.y, 20)
    s.step()
    expect(pile.stock).toBe(29)
    expect(one.prey.meals).toBe(1)
  })

  it('releases four stoats and three deer, and culls a third of the deer', () => {
    expect(act('releaseStoat').s.pops.stoat.length - act('releaseStoat').before.pops.stoat).toBe(4)
    const deer = act('releaseDeer')
    expect(deer.s.pops.deer.length - deer.before.pops.deer).toBe(3)
    const cull = act('cullDeer')
    expect(cull.before.pops.deer).toBe(4)
    expect(cull.s.pops.deer.length).toBe(3)
    expect(cull.s.tally.deer.culled).toBe(1)
  })

  it('Wild meadow actions do nothing where stoats and deer do not live', () => {
    for (const action of ['releaseStoat', 'cullDeer', 'releaseDeer'] as const) {
      const { s } = act(action, deriveParams(STABLE_PRESET, THREE_SPECIES))
      expect([s.pops.stoat.length, s.pops.deer.length, s.tally.deer.culled]).toEqual([0, 0, 0])
    }
  })

  it('offers habitat actions everywhere and Wild meadow actions only there', () => {
    const ids = (sp: readonly Species[]) => actionsFor(sp).map(a => a.id)
    expect(ids(TWO_SPECIES).slice(-3)).toEqual(['mow', 'sow', 'hay'])
    expect(ids(THREE_SPECIES).slice(-5)).toEqual(['releaseVole', 'illnessVole', 'mow', 'sow', 'hay'])
    expect(ids(FIVE_SPECIES).slice(-3)).toEqual(['releaseStoat', 'cullDeer', 'releaseDeer'])
    expect(ids(THREE_SPECIES)).not.toContain('releaseStoat')
    expect([optionCount(TWO_SPECIES), optionCount(THREE_SPECIES), optionCount(FIVE_SPECIES)]).toEqual(['eleven', 'thirteen', 'sixteen'])
  })

  it('Starting stoats and Starting deer levers exist only in the Wild meadow', () => {
    expect(leversFor(THREE_SPECIES).map(l => l.id)).not.toContain('stoat.initial')
    expect(leversFor(FIVE_SPECIES).map(l => l.id)).toEqual(expect.arrayContaining(['stoat.initial', 'deer.initial']))
    const p = deriveParams({ ...STABLE_PRESET, 'stoat.initial': 20, 'deer.initial': 4 }, FIVE_SPECIES)
    expect([p.stoat!.body.initial, p.deer!.body.initial]).toEqual([20, 4])
    expect(SCENARIOS.at(-1)!.id).toBe('wild')
  })
})

const ACTIONS: Record<number, Intervention> = { 100: 'mow', 300: 'hay', 500: 'sow', 600: 'releaseStoat', 700: 'cullDeer' }

describe('five-species determinism and saves', () => {
  const run = (seed: number, until: number, s = new Sim(wildParams(), seed)) => {
    while (s.tick < until && !s.ended) {
      const action = ACTIONS[s.tick]
      if (action) s.queue(action)
      s.step()
    }
    return s
  }

  it('replays the same seed and actions identically', () => {
    const a = run(9601, 1200)
    const b = run(9601, 1200)
    expect(a.tick).toBe(1200)
    expect(b.save()).toEqual(a.save())
  }, 120_000)

  it('continues exactly from a checkpoint with mown grass, hay and a pending action', () => {
    const a = run(9602, 400)
    expect(a.mown.length).toBe(4)
    expect(a.bushes.some(b => b.hay !== undefined)).toBe(true)
    a.queue('releaseDeer')
    const saved = a.save()
    expect(saved.species).toEqual(['prey', 'pred', 'vole', 'stoat', 'deer'])
    const b = Sim.restore(structuredClone(saved))
    run(0, 1400, a)
    run(0, 1400, b)
    expect(b.tick).toBe(a.tick)
    expect(a.tick).toBe(1400)
    expect(b.save()).toEqual(a.save())
    expect(summarizeEvolution(b)).toEqual(summarizeEvolution(a))
  }, 120_000)

  it('loads a version-3 Vole meadow save from before the Wild meadow', () => {
    const s = new Sim(deriveParams(STABLE_PRESET, THREE_SPECIES), 5)
    for (let i = 0; i < 200; i++) s.step()
    const state = structuredClone(s.save()) as Partial<ReturnType<Sim['save']>>
    for (const key of ['pops', 'founders', 'tally', 'lastBirth', 'nextId'] as const) {
      const r = state[key] as Record<string, unknown>
      delete r.stoat
      delete r.deer
    }
    delete state.cover
    delete state.mown
    const stats = new Float64Array((HISTORY_HOURS + 1) * STAT_STRIDE_V3)
    stats[150 * STAT_STRIDE_V3 + STAT.vole] = 77
    stats[150 * STAT_STRIDE_V3 + STAT.seed] = 0.5
    const { stoat: _s, deer: _d, ...sample } = summarizeEvolution(s)
    const old = {
      version: 3, savedAt: '2026-09-01T00:00:00.000Z',
      config: { levers: STABLE_PRESET, base: STABLE_PRESET, scenario: 'voles', seed: 5, endless: false },
      state, history: { stats, head: 200, start: 0, frames: [] }, evolution: [sample],
    } as unknown as MeadowSave
    const save = migrateSave(old)
    expect(save.history.stats.length).toBe((HISTORY_HOURS + 1) * STAT_STRIDE)
    expect(save.history.stats[150 * STAT_STRIDE + STAT.vole]).toBe(77)
    expect(save.history.stats[150 * STAT_STRIDE + STAT.seed]).toBe(0.5)
    expect(save.history.stats[150 * STAT_STRIDE + STAT.stoat]).toBe(0)
    expect(save.evolution![0].deer.count).toBe(0)
    const back = Sim.restore(save.state)
    expect(back.species).toEqual(['prey', 'pred', 'vole'])
    expect(back.cover).toEqual(s.cover)
    for (let i = 0; i < 300; i++) { back.step(); s.step() }
    expect(back.pops.vole.map(a => a.id)).toEqual(s.pops.vole.map(a => a.id))
    expect(back.tally.vole).toEqual(s.tally.vole)
  }, 60_000)
})

describe('Open and Vole meadows are unchanged by the Wild meadow', () => {
  /** Values recorded from origin/main (before stoats, deer and habitat actions) at hour 1500 of seed 5000. */
  it.each([
    ['stable', { pops: [160, 25], born: [1405, 55], eaten: [271, 0], bushes: 34 }],
    ['voles', { pops: [157, 26, 85], born: [1301, 42, 1989], eaten: [192, 0, 132], bushes: 22 }],
  ] as const)('%s meadow, seed 5000, hour 1500', (id, want) => {
    const sc = SCENARIO_BY_ID[id]
    const s = new Sim(deriveParams(STABLE_PRESET, sc.species), 5000, sc.disturbance)
    while (s.tick < 1500 && s.step()) { /* run */ }
    expect({ pops: s.species.map(sp => s.pops[sp].length), born: s.species.map(sp => s.tally[sp].born),
      eaten: s.species.map(sp => s.tally[sp].eaten), bushes: s.bushes.length }).toEqual(want)
  }, 60_000)
})
