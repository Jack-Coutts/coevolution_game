import { describe, expect, it } from 'vitest'
import { STABLE_PRESET } from '@/game/presets'
import { HISTORY_HOURS } from '@/game/history'
import { migrateSave, type MeadowSave } from '@/game/saves'
import { bodyValues, childGene, clampGene, defaultBody, founderGene, sizeOf, SIZE_MAX, SIZE_MIN } from '@/sim/body'
import type { Genome } from '@/sim/brain'
import { summarizeEvolution } from '@/sim/evolution'
import { deriveParams } from '@/sim/levers'
import { defaultParams, type SimParams } from '@/sim/params'
import { Rng } from '@/sim/rng'
import { Sim, type Creature, type MeadowState } from '@/sim/sim'
import { THREE_SPECIES } from '@/sim/species'
import { frame } from '@/worker/pack'
import { ANIMAL_SIZE, ANIMAL_STRIDE, ANIMAL_STRIDE_V3, STAT_STRIDE } from '@/worker/protocol'

function bodyOn(p: SimParams = deriveParams(STABLE_PRESET)): SimParams {
  p.eco.body = defaultBody()
  return p
}

/** Genomes that differ only in their size gene. */
function lines(p: SimParams, genes: number[], seed = 3): { prey: Genome[]; pred: Genome[] } {
  const s = new Sim(p, seed)
  return {
    prey: genes.map(g => ({ ...s.prey[0].brain, sizeGene: g })),
    pred: genes.map(g => ({ ...s.preds[0].brain, sizeGene: g })),
  }
}

/** Two rabbits (large, small) and two foxes (large, small), fed and parked apart, not moving. */
function arena(still = true) {
  const p = bodyOn()
  if (still) { p.prey.step = 0; p.pred.step = 0 }
  p.sproutPerDay = 0
  const g = lines(p, [1, -1])
  const s = new Sim(p, 21, undefined, { genomes: g, counts: { prey: 2, pred: 2 }, noBirths: true, noAging: true })
  const [big, small] = s.prey
  const [bigFox, smallFox] = s.preds
  const park = (a: Creature, x: number, y: number, energy = a.maxEnergy) => {
    a.x = x; a.y = y; a.inCover = s.inCover(x, y); a.energy = energy
  }
  park(big, 0.001, 0.001); park(small, 0.001, 0.999); park(bigFox, 0.999, 0.001); park(smallFox, 0.999, 0.999)
  return { p, s, big, small, bigFox, smallFox, park }
}

describe('body size gene', () => {
  it('maps the bounded gene to ×0.8–×1.25, with gene 0 exactly neutral', () => {
    expect(sizeOf(0)).toBe(1)
    expect(sizeOf(1)).toBe(1.25)
    expect(sizeOf(-1)).toBe(0.8)
    expect(sizeOf(7)).toBe(SIZE_MAX)
    expect(sizeOf(-7)).toBe(SIZE_MIN)
    expect(clampGene(1.3)).toBe(1)
    expect(clampGene(-1.3)).toBe(-1)
  })

  it('derives reserves, metabolism and top speed from the species body (literal values)', () => {
    const prey = defaultParams().prey
    const big = bodyValues(prey, 1.25)
    expect(big.maxEnergy).toBe(125)
    expect(big.metabolism).toBeCloseTo(0.35 * 1.25 ** 0.75, 15)
    expect(big.metabolism).toBeCloseTo(0.4138, 4)
    expect(big.topStep).toBeCloseTo(0.0089443, 7)
    const small = bodyValues(prey, 0.8)
    expect(small.maxEnergy).toBe(80)
    expect(small.metabolism).toBeCloseTo(0.2961, 4)
    expect(small.topStep).toBeCloseTo(0.0111803, 7)
    expect(bodyValues(prey, 1)).toEqual({ size: 1, maxEnergy: prey.maxEnergy, metabolism: prey.metabolism, topStep: prey.step })
  })

  it('children copy the parent gene exactly without mutation, and take one parent’s gene when sexual', () => {
    const cfg = defaultBody()
    const rng = new Rng(5)
    for (let i = 0; i < 50; i++) expect(childGene(rng, 0.37, null, 0, cfg)).toBe(0.37)
    const picks = new Set<number>()
    for (let i = 0; i < 200; i++) picks.add(childGene(rng, 0.37, -0.6, 0, cfg))
    expect([...picks].sort()).toEqual([-0.6, 0.37])
  })

  it('mutation moves the gene by a normal step of sigma and never leaves [-1, 1]', () => {
    const cfg = defaultBody()
    const rng = new Rng(8)
    const steps: number[] = []
    for (let i = 0; i < 4000; i++) steps.push(childGene(rng, 0, null, 1, cfg))
    const mean = steps.reduce((a, b) => a + b, 0) / steps.length
    const sd = Math.sqrt(steps.reduce((a, b) => a + (b - mean) ** 2, 0) / steps.length)
    expect(Math.abs(mean)).toBeLessThan(0.01)
    expect(sd).toBeGreaterThan(0.09)
    expect(sd).toBeLessThan(0.11)
    for (let i = 0; i < 500; i++) {
      const up = childGene(rng, 1, null, 1, { spread: 1, sigma: 0.5 })
      const down = childGene(rng, -1, null, 1, { spread: 1, sigma: 0.5 })
      expect(up).toBeLessThanOrEqual(1)
      expect(down).toBeGreaterThanOrEqual(-1)
    }
    const f = new Rng(2)
    for (let i = 0; i < 200; i++) expect(Math.abs(founderGene(f, { spread: 0.4, sigma: 0.1 }))).toBeLessThanOrEqual(0.4)
  })

  it('in a meadow, births inherit the gene: a mutation-free year keeps only founder sizes', () => {
    const p = bodyOn()
    p.mutationRate = 0
    const s = new Sim(p, 9400)
    const founders = new Set([...s.prey, ...s.preds].map(a => a.brain.sizeGene))
    for (let i = 0; i < 1500 && s.step(); i++) { /* run */ }
    const born = [...s.prey, ...s.preds].filter(a => a.gen > 0)
    expect(born.length).toBeGreaterThan(0)
    for (const a of born) {
      expect(founders.has(a.brain.sizeGene)).toBe(true)
      expect(a.size).toBe(sizeOf(a.brain.sizeGene!))
    }
  })

  it('with mutation, meadow genes stay within bounds and sizes match genes', () => {
    const p = bodyOn()
    p.mutationRate = 1
    p.eco.body = { spread: 1, sigma: 0.6 }
    const s = new Sim(p, 9401)
    for (let i = 0; i < 1200 && s.step(); i++) { /* run */ }
    const all = [...s.prey, ...s.preds]
    expect(all.some(a => a.gen > 0)).toBe(true)
    for (const a of all) {
      expect(Math.abs(a.brain.sizeGene!)).toBeLessThanOrEqual(1)
      expect(a.size).toBeGreaterThanOrEqual(SIZE_MIN)
      expect(a.size).toBeLessThanOrEqual(SIZE_MAX)
      expect(a.maxEnergy).toBeCloseTo(s.defs[a.species].body.maxEnergy * a.size, 12)
    }
  })
})

describe('body size energy accounting', () => {
  it('a resting-free hour costs basal × m^0.75 + vision + speedCost × m × (step/baseStep)²', () => {
    const { s, big, small, p } = arena(false)
    const before = [big.energy, small.energy]
    s.step()
    for (const [a, e0] of [[big, before[0]], [small, before[1]]] as const) {
      const r = (a.pace * a.topStep) / p.prey.baseStep
      const cost = a.metabolism + p.prey.visionUpkeep * a.view + p.prey.speedCost * a.size * r * r
      expect(e0 - a.energy).toBeCloseTo(cost, 12)
    }
    expect(big.maxEnergy).toBe(p.prey.maxEnergy * 1.25)
    expect(small.maxEnergy).toBe(p.prey.maxEnergy * 0.8)
    // Full pace: equal cost per hour for every size, so more per distance for the large body.
    expect(p.prey.speedCost * 1.25 * (big.topStep / p.prey.baseStep) ** 2).toBeCloseTo(p.prey.speedCost * (p.prey.step / p.prey.baseStep) ** 2, 12)
    expect(big.topStep).toBeLessThan(p.prey.step)
    expect(small.topStep).toBeGreaterThan(p.prey.step)
  })

  it('a large rabbit bites more berries and gains more energy per bite', () => {
    const { s, big, small, p, park } = arena()
    const b = s.bushes.find(b => !s.inCover(b.x, b.y))!
    const stock = b.stock
    park(big, b.x, b.y, 20)
    s.step()
    const bigGain = big.energy - 20 + (big.metabolism + p.prey.visionUpkeep * big.view)
    expect(bigGain).toBeCloseTo(p.prey.mealEnergy * 1.25, 10)
    expect(b.stock).toBeCloseTo(stock - 1.25, 10)
    park(big, 0.001, 0.001)
    park(small, b.x, b.y, 20)
    const stock2 = b.stock
    s.step()
    const smallGain = small.energy - 20 + (small.metabolism + p.prey.visionUpkeep * small.view)
    expect(smallGain).toBeCloseTo(p.prey.mealEnergy * 0.8, 10)
    expect(b.stock).toBeCloseTo(stock2 - 0.8, 10)
  })

  it('catch reach is eatR times the mean body size; a large victim is a larger meal', () => {
    const { s, big, small, bigFox, smallFox, p, park } = arena()
    const d = p.eatR * 1.05 // beyond neutral reach, inside large-fox + large-rabbit reach
    park(bigFox, 0.5, 0.5, bigFox.maxEnergy / 2)
    park(big, 0.5 + d, 0.5)
    park(smallFox, 0.2, 0.8, smallFox.maxEnergy / 2)
    park(small, 0.2 + d, 0.8)
    const foxE = bigFox.energy
    s.step()
    expect(s.prey.includes(big)).toBe(false)
    expect(s.prey.includes(small)).toBe(true)
    expect(bigFox.energy - foxE + (bigFox.metabolism + p.pred.visionUpkeep * bigFox.view)).toBeCloseTo(p.pred.mealEnergy * 1.25, 10)
  })

  it('breeding thresholds and the energy given to each young scale with the parent’s own max energy', () => {
    const p = bodyOn()
    p.prey.step = 0
    p.pred.step = 0
    const g = lines(p, [1])
    const s = new Sim(p, 22, undefined, { genomes: g, counts: { prey: 1, pred: 1 } })
    const [mum] = s.prey
    s.preds[0].x = 0.999; s.preds[0].y = 0.999; mum.x = 0.001; mum.y = 0.001
    mum.age = p.prey.adultAge
    mum.energy = mum.maxEnergy
    s.step()
    const kid = s.prey.find(a => a !== mum)!
    expect(kid).toBeDefined()
    expect(kid.energy).toBe(p.prey.childEnergy * mum.maxEnergy)
    expect(kid.brain.sizeGene).toBeCloseTo(1, 0)
  })
})

/** The base meadow with body evolution switched off. */
function bodyOff(p: SimParams = deriveParams(STABLE_PRESET)): SimParams {
  p.eco.body = undefined
  return p
}

describe('body evolution off', () => {
  it('is on by default in new meadows', () => {
    expect(deriveParams(STABLE_PRESET).eco.body).toEqual(defaultBody())
  })

  it('ignores size genes: every animal is exactly the species body', () => {
    const p = bodyOff()
    const g = lines(p, [1, -1])
    const s = new Sim(p, 4, undefined, { genomes: g })
    for (const a of [...s.prey, ...s.preds]) {
      expect(a.size).toBe(1)
      expect(a.maxEnergy).toBe(s.defs[a.species].body.maxEnergy)
      expect(a.topStep).toBe(s.defs[a.species].body.step)
      expect(a.metabolism).toBe(s.defs[a.species].body.metabolism)
    }
  })

  it('runs identically whether or not genomes carry size genes', () => {
    const p = bodyOff()
    const plain = new Sim(p, 77)
    const tagged = new Sim(p, 77, undefined, { genomes: { prey: plain.prey.map(a => ({ ...a.brain, sizeGene: 1 })), pred: plain.preds.map(a => ({ ...a.brain, sizeGene: -1 })) } })
    const ref = new Sim(p, 77, undefined, { genomes: { prey: plain.prey.map(a => a.brain), pred: plain.preds.map(a => a.brain) } })
    for (let i = 0; i < 400; i++) { tagged.step(); ref.step() }
    expect(tagged.prey.map(a => [a.x, a.y, a.energy])).toEqual(ref.prey.map(a => [a.x, a.y, a.energy]))
    expect(tagged.tally).toEqual(ref.tally)
  })
})

describe('body size persistence and display', () => {
  it('save and resume continue exactly, with the saved genes (literal values)', () => {
    const p = bodyOn(deriveParams(STABLE_PRESET, THREE_SPECIES))
    const a = new Sim(p, 9402)
    for (let i = 0; i < 600; i++) a.step()
    const state = structuredClone(a.save())
    const first = state.pops.prey[0]
    expect(first.id).toBe(36)
    expect(first.brain.sizeGene).toBe(0.8734319049894028)
    expect(first.size).toBe(1.215190308589027)
    expect(first.maxEnergy).toBe(218.73425554602485)
    expect(state.pops.vole[0].id).toBe(487)
    expect(state.pops.vole[0].brain.sizeGene).toBe(-0.1770222830970809)
    const b = Sim.restore(state)
    for (let i = 0; i < 300; i++) { a.step(); b.step() }
    const view = (s: Sim) => s.species.map(k => s.pops[k].map(c => [c.id, c.size, c.brain.sizeGene, c.energy, c.x]))
    expect(view(b)).toEqual(view(a))
    expect(b.tally).toEqual(a.tally)
  })

  it('a save from before body size loads every animal at ×1 with its species body', () => {
    const p = bodyOff()
    const s = new Sim(p, 12)
    for (let i = 0; i < 50; i++) s.step()
    const old = structuredClone(s.save()) as MeadowState
    for (const a of [...old.pops.prey, ...old.pops.pred] as unknown as Record<string, unknown>[])
      for (const k of ['size', 'maxEnergy', 'metabolism', 'topStep']) delete a[k]
    const r = Sim.restore(old)
    for (const a of [...r.prey, ...r.preds]) {
      expect(a.size).toBe(1)
      expect(a.maxEnergy).toBe(r.defs[a.species].body.maxEnergy)
      expect(a.topStep).toBe(r.defs[a.species].body.step)
    }
    for (let i = 0; i < 100; i++) { r.step(); s.step() }
    expect(r.prey.map(a => [a.id, a.energy])).toEqual(s.prey.map(a => [a.id, a.energy]))
  })

  it('frames carry the size; old replay frames are widened with size 1', () => {
    const p = bodyOn()
    const s = new Sim(p, 30)
    const f = frame(s)
    expect(f.prey.length).toBe(s.prey.length * ANIMAL_STRIDE)
    for (let i = 0; i < s.prey.length; i++) expect(f.prey[i * ANIMAL_STRIDE + ANIMAL_SIZE]).toBeCloseTo(s.prey[i].size, 6)
    const old = new Float32Array(2 * ANIMAL_STRIDE_V3).map((_, i) => i)
    const save = { version: 3, state: { version: 3 }, evolution: [],
      history: { stats: new Float64Array((HISTORY_HOURS + 1) * STAT_STRIDE), frames: [[5, { tick: 5, prey: old, preds: new Float32Array(0), bushes: new Float32Array(0), events: new Float32Array(0) }]] } } as unknown as MeadowSave
    const migrated = migrateSave(save)
    const prey = migrated.history.frames[0][1].prey
    expect(prey.length).toBe(2 * ANIMAL_STRIDE)
    expect(prey[ANIMAL_SIZE]).toBe(1)
    expect(prey[ANIMAL_STRIDE + ANIMAL_SIZE]).toBe(1)
    expect(prey[ANIMAL_STRIDE + 21]).toBe(ANIMAL_STRIDE_V3 + 21)
    expect(migrated.history.animalStride).toBe(ANIMAL_STRIDE)
  })

  it('evolution samples chart body size as mean and middle 80%', () => {
    const p = bodyOn()
    const s = new Sim(p, 31)
    const e = summarizeEvolution(s)
    const sizes = s.prey.map(a => a.size).sort((a, b) => a - b)
    expect(e.prey.traits.size!.mean).toBeCloseTo(sizes.reduce((a, b) => a + b, 0) / sizes.length, 12)
    expect(e.prey.traits.size!.low).toBe(sizes[Math.floor((sizes.length - 1) * 0.1)])
    expect(e.prey.traits.size!.high).toBe(sizes[Math.floor((sizes.length - 1) * 0.9)])
    const off = summarizeEvolution(new Sim(bodyOff(), 31))
    expect(off.prey.traits.size).toEqual({ mean: 1, low: 1, high: 1 })
  })
})
