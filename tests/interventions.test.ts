import { it, expect } from 'vitest'
import { deriveParams } from '@/sim/levers'
import { STABLE_PRESET } from '@/game/presets'
import { Sim } from '@/sim/sim'

it('illness is species-specific, local, deterministic and survives checkpointing', () => {
  const p = deriveParams(STABLE_PRESET)
  const a = new Sim(p, 101)
  a.queue('illnessPrey'); a.step()
  expect(a.prey.filter(x => x.illUntil > a.tick).length).toBe(6)
  expect(a.preds.every(x => x.illUntil === 0)).toBe(true)
  const b = Sim.restore(structuredClone(a.save()))
  for (let i = 0; i < 100; i++) { a.step(); b.step() }
  expect(b.save()).toEqual(a.save())
})
it('attributes energy exhaustion during illness separately from ordinary starvation', () => {
  const p = deriveParams(STABLE_PRESET); p.pred.step = 0; p.prey.step = 0
  const s = new Sim(p, 102)
  const fox = s.preds[0]
  fox.x = 0; fox.y = 0; fox.energy = 0.01; fox.illUntil = 200
  s.pops.pred = [fox]
  for (const a of s.prey) { a.x = 1; a.y = 1 }
  s.step()
  expect(s.counters.predIllness).toBe(1)
  expect(s.counters.predStarved).toBe(0)
})
it('illness increases the energy cost and ends after its duration', () => {
  const p = deriveParams(STABLE_PRESET); p.pred.step = 0; p.prey.step = 0
  const healthy = new Sim(p, 20), sick = new Sim(p, 20)
  for (const s of [healthy, sick]) { for (const a of s.prey) { a.x = 1; a.y = 1 }; for (const a of s.preds) { a.x = 0; a.y = 0; a.energy = p.pred.maxEnergy } }
  sick.preds[0].illUntil = 2
  healthy.step(); sick.step()
  expect(healthy.preds[0].energy - sick.preds[0].energy).toBeCloseTo(0.65)
  healthy.step(); sick.step()
  expect(healthy.preds[0].energy - sick.preds[0].energy).toBeCloseTo(0.65)
})
it('planting creates four stocked bushes and feeding refills fox energy without killing prey', () => {
  const s = new Sim(deriveParams(STABLE_PRESET), 30)
  const bushes = s.bushes.length
  s.queue('plantBushes'); s.queue('feedFoxes'); s.step()
  expect(s.bushes.length).toBe(bushes + 4)
  expect(s.preds.every(a => a.energy > s.p.pred.maxEnergy - 5)).toBe(true)
  expect(s.counters.preyEaten).toBe(0)
})
it('released descendants retain their lineage and generation', () => {
  const s = new Sim(deriveParams(STABLE_PRESET), 14)
  const founder = s.preds[0]
  s.pops.pred = [founder]
  s.queue('releasePred'); s.step()
  const arrivals = s.preds.filter(a => a.id !== founder.id)
  expect(arrivals.length).toBe(3)
  expect(arrivals.every(a => a.gen > 0 && a.lineage === founder.lineage && a.parent >= 0)).toBe(true)
})
it('spreads to nearby members of the same species without reaching isolated animals', () => {
  const p = deriveParams(STABLE_PRESET); p.prey.step = 0; p.pred.step = 0
  const s = new Sim(p, 17, undefined, { noBirths: true, noAging: true })
  const [source, neighbour, isolated] = s.prey
  s.pops.prey = [source, neighbour, isolated]
  source.x = neighbour.x = 0.1; source.y = neighbour.y = 0.1
  isolated.x = isolated.y = 0.8
  for (const a of [...s.prey, ...s.preds]) a.energy = 100000
  for (const a of s.preds) { a.x = 0.99; a.y = 0.99 }
  source.illUntil = 240; source.immuneUntil = 720
  for (let i = 0; i < 180; i++) s.step()
  expect(neighbour.illUntil).toBeGreaterThan(0)
  expect(isolated.illUntil).toBe(0)
  expect(s.preds.every(a => a.illUntil === 0)).toBe(true)
})
