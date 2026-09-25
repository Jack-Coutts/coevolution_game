import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { HISTORY_HOURS } from '@/game/history'
import { STABLE_PRESET } from '@/game/presets'
import { INCOMPATIBLE_SAVE, migrateSave, type MeadowSaveV2 } from '@/game/saves'
import { summarizeEvolution } from '@/sim/evolution'
import { deriveParams } from '@/sim/levers'
import { SCENARIO_BY_ID } from '@/sim/scenarios'
import { migrateState, Sim, type Intervention, type MeadowStateV2 } from '@/sim/sim'
import { STAT, STAT_STRIDE, STAT_STRIDE_V2 } from '@/worker/protocol'

const voleParams = () => deriveParams(STABLE_PRESET, SCENARIO_BY_ID.voles.species)
const ACTIONS: Record<number, Intervention> = { 300: 'releaseVole', 700: 'illnessVole', 1100: 'cullPred', 1500: 'rain' }

/** Everything that changes hour to hour, compared by value. */
function hour(s: Sim) {
  return {
    tick: s.tick,
    pops: s.species.map(sp => s.pops[sp].map(a => [a.id, a.x, a.y, a.energy, a.illUntil])),
    tally: structuredClone(s.tally),
    seed: [...s.grassSeed],
    bushes: s.bushes.map(b => [b.id, b.stock]),
  }
}

describe('three-species determinism', () => {
  it('replays the same seed and action hours identically, hour by hour', () => {
    const run = () => {
      const s = new Sim(voleParams(), 9001)
      const out: ReturnType<typeof hour>[] = []
      for (let t = 0; t < 2000 && !s.ended; t++) {
        const action = ACTIONS[s.tick]
        if (action) s.queue(action)
        s.step()
        out.push(hour(s))
      }
      return out
    }
    const a = run()
    expect(a.length).toBeGreaterThan(1000)
    expect(a.at(-1)!.pops[2].length).toBeGreaterThan(0)
    expect(run()).toEqual(a)
  }, 120_000)

  it('continues exactly from a checkpoint at hour 1000 to hour 3000', () => {
    const a = new Sim(voleParams(), 9002, undefined, { record: true })
    for (let i = 0; i < 1000; i++) {
      const action = ACTIONS[a.tick]
      if (action) a.queue(action)
      a.step()
    }
    a.queue('releaseVole')
    const saved = a.save()
    expect(saved.version).toBe(3)
    expect(saved.species).toEqual(['prey', 'pred', 'vole'])
    const b = Sim.restore(structuredClone(saved))
    while (a.tick < 3000 && !a.ended) {
      a.step()
      b.step()
    }
    expect(b.tick).toBe(a.tick)
    expect(a.tick).toBeGreaterThan(1500)
    expect(b.save()).toEqual(a.save())
    expect(summarizeEvolution(b)).toEqual(summarizeEvolution(a))
  }, 120_000)
})

/** Fixture: `Sim.save()` from the version-2 engine at hour 120, and a digest of that engine 500 hours later. */
const fixture = JSON.parse(readFileSync(new URL('./fixtures/meadow-v2.json', import.meta.url), 'utf8'),
  (_k, v) => v && typeof v === 'object' && '$f64' in v ? Float64Array.from(v.$f64) : v) as {
  state: MeadowStateV2
  after: { tick: number; prey: number; pred: number; counters: Record<string, number>; digest: string }
}
const replacer = (_k: string, v: unknown) => v instanceof Float64Array ? { $f64: Array.from(v) } : v

/** The same digest the fixture generator took from the version-2 engine, over the fields both versions share. */
function digestV2(s: Sim): string {
  const d = s.save()
  const keep = { tick: d.tick, ended: d.ended, pops: { prey: d.pops.prey, pred: d.pops.pred }, bushes: d.bushes, counters: s.counters,
    evo: d.evo, lastBirth: { prey: d.lastBirth.prey, pred: d.lastBirth.pred }, nextId: { prey: d.nextId.prey, pred: d.nextId.pred },
    nextBush: d.nextBush, regrowAcc: d.regrowAcc, sproutAcc: d.sproutAcc, pending: d.pending, ceilingHits: d.ceilingHits,
    rng: d.rng, evRng: d.evRng, foodRng: d.foodRng }
  return createHash('sha256').update(JSON.stringify(keep, replacer)).digest('hex')
}

describe('version-2 saves', () => {
  it('load as a two-species meadow and continue exactly as the version-2 engine for 500 hours', () => {
    const s = Sim.restore(structuredClone(fixture.state))
    expect(s.species).toEqual(['prey', 'pred'])
    expect(s.voles).toEqual([])
    expect(s.grassSeed).toEqual([])
    expect(s.tally.vole).toEqual({ born: 0, starved: 0, eaten: 0, old: 0, illness: 0, culled: 0 })
    expect(s.counters).toEqual(fixture.state.counters)
    for (let i = 0; i < 500; i++) s.step()
    expect({ tick: s.tick, prey: s.prey.length, pred: s.preds.length, counters: s.counters })
      .toEqual({ tick: fixture.after.tick, prey: fixture.after.prey, pred: fixture.after.pred, counters: fixture.after.counters })
    expect(digestV2(s)).toBe(fixture.after.digest)
    expect(s.save().version).toBe(3)
  }, 60_000)

  it('refuse a corrupted or unknown state whole', () => {
    expect(() => migrateState({ ...fixture.state, version: 7 } as never)).toThrow()
    const { counters: _, ...noCounters } = fixture.state
    expect(() => Sim.restore(noCounters as never)).toThrow()
  })

  const v2Save = (): MeadowSaveV2 => {
    const stats = new Float64Array((HISTORY_HOURS + 1) * STAT_STRIDE_V2)
    for (let t = 0; t <= 120; t++) {
      stats[t * STAT_STRIDE_V2 + STAT.prey] = 30 + t
      stats[t * STAT_STRIDE_V2 + STAT.predIllness] = 1
    }
    const sample = summarizeEvolution(Sim.restore(structuredClone(fixture.state)))
    const { vole: _, ...twoSpecies } = sample
    return {
      version: 2, savedAt: '2026-09-01T00:00:00.000Z',
      config: { levers: STABLE_PRESET, base: STABLE_PRESET, scenario: 'stable', seed: 4242, endless: false },
      state: structuredClone(fixture.state),
      history: { stats, highestGeneration: { prey: 3, pred: 1 }, head: 120, start: 0, frames: [] },
      charges: 3, cooldownUntil: 400, interventions: [{ tick: 20, action: 'rain' }],
      evolution: [twoSpecies], journal: [{ tick: 10, text: 'note' }],
    }
  }

  it('migrate whole saves: state, widened statistics rows and evolution samples', () => {
    const save = migrateSave(v2Save())
    expect(save.version).toBe(3)
    expect(save.state.version).toBe(3)
    expect(save.state.species).toEqual(['prey', 'pred'])
    expect(save.history.stats.length).toBe((HISTORY_HOURS + 1) * STAT_STRIDE)
    expect(save.history.stats[57 * STAT_STRIDE + STAT.prey]).toBe(87)
    expect(save.history.stats[57 * STAT_STRIDE + STAT.predIllness]).toBe(1)
    expect(save.history.stats[57 * STAT_STRIDE + STAT.vole]).toBe(0)
    expect(save.history.highestGeneration).toEqual({ prey: 3, pred: 1, vole: 0 })
    expect(save.evolution?.[0].vole.count).toBe(0)
    expect(save.charges).toBe(3)
    expect(Sim.restore(save.state).tick).toBe(120)
    expect(migrateSave(save)).toBe(save)
  })

  it('show the clear message for a corrupted save', () => {
    const broken = v2Save()
    broken.history.stats = new Float64Array(10)
    expect(() => migrateSave(broken)).toThrow(INCOMPATIBLE_SAVE)
    const unknown = { ...v2Save(), version: 1 } as never
    expect(() => migrateSave(unknown)).toThrow(INCOMPATIBLE_SAVE)
    const badState = v2Save()
    ;(badState.state as { version: number }).version = 9
    expect(() => migrateSave(badState)).toThrow(INCOMPATIBLE_SAVE)
  })
})
