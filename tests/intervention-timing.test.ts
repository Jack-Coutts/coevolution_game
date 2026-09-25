import { describe, expect, it } from 'vitest'
import { STABLE_PRESET } from '@/game/presets'
import { deriveParams } from '@/sim/levers'
import { SCENARIO_BY_ID } from '@/sim/scenarios'
import { Sim, type Intervention } from '@/sim/sim'
import { SimCore } from '@/worker/core'
import { STAT, STAT_STRIDE, type FromWorker } from '@/worker/protocol'

const params = deriveParams(STABLE_PRESET)
const dist = SCENARIO_BY_ID.stable.disturbance

/** Drive the worker core like the controller does: it runs ahead of the display in chunks. */
function worker(seed: number) {
  const posts: FromWorker[] = []
  const core = new SimCore(m => posts.push(m))
  core.handle({ type: 'init', runId: 1, params, seed, disturbance: dist })
  const rows = new Map<number, Float64Array>()
  const collect = () => {
    for (const m of posts.splice(0)) {
      if (m.type === 'frames') m.frames.forEach((f, i) => rows.set(f.tick, m.stats.slice(i * STAT_STRIDE, (i + 1) * STAT_STRIDE)))
      if (m.type === 'intervened') rows.set(m.tick, m.stats)
      if (m.type === 'intervened' || m.type === 'ready') last = m
    }
  }
  let last: FromWorker | null = null
  let head = 0
  return {
    advance(target: number) {
      while (head < target) {
        core.handle({ type: 'advance', runId: 1, target })
        const m = posts.findLast(p => p.type === 'frames')
        if (m?.type === 'frames') head = m.head
        collect()
      }
    },
    intervene(action: Intervention, at: number) {
      core.handle({ type: 'intervene', runId: 1, action, at })
      const m = posts.at(-1)
      collect()
      if (m?.type !== 'intervened') throw new Error('no reply')
      head = m.tick
      return m
    },
    stat: (tick: number, key: keyof typeof STAT) => rows.get(tick)?.[STAT[key]],
    get last() { return last },
  }
}

function reference(seed: number, actions: [number, Intervention][], until: number) {
  const sim = new Sim(params, seed, dist, { record: true })
  const counts = new Map<number, [number, number, number]>()
  while (sim.tick < until) {
    for (const [t, a] of actions) if (t === sim.tick) sim.queue(a)
    sim.step()
    counts.set(sim.tick, [sim.prey.length, sim.preds.length, sim.counters.predCulled])
  }
  return counts
}

describe('interventions apply at the displayed hour', () => {
  it('rewinds a worker that ran ahead, applies the action one hour after the displayed hour, and shows it at once', () => {
    const w = worker(7)
    w.advance(40)
    // The player sees hour 30 (paused) while the worker has already simulated to 40.
    const reply = w.intervene('cullPred', 30)
    expect(reply.from).toBe(30)
    expect(reply.tick).toBe(31)
    expect(reply.frame.tick).toBe(31)
    expect(reply.stats[STAT.predCulled]).toBe(2)
    expect(w.stat(30, 'predCulled')).toBe(0)
  })

  it('reproduces a headless run with the same seed, settings and action hours', () => {
    const w = worker(7)
    w.advance(40)
    w.intervene('cullPred', 30)
    w.advance(90)
    w.intervene('plantBushes', 72)
    w.advance(150)
    const ref = reference(7, [[30, 'cullPred'], [72, 'plantBushes']], 150)
    for (const t of [31, 60, 73, 100, 150]) {
      const [prey, pred, culled] = ref.get(t) ?? []
      expect([w.stat(t, 'prey'), w.stat(t, 'pred'), w.stat(t, 'predCulled')], `hour ${t}`).toEqual([prey, pred, culled])
    }
  })

  it('applies at once when the worker has not run ahead', () => {
    const w = worker(7)
    w.advance(24)
    const reply = w.intervene('rain', 24)
    expect([reply.from, reply.tick]).toEqual([24, 25])
    expect(reply.stats[STAT.stock]).toBeGreaterThan(0.99)
  })

  it('keeps an earlier action when a later one rewinds past the next checkpoint', () => {
    const w = worker(7)
    w.advance(80)
    w.intervene('cullPred', 71)
    w.advance(100)
    w.intervene('releasePred', 92)
    w.advance(120)
    const ref = reference(7, [[71, 'cullPred'], [92, 'releasePred']], 120)
    expect([w.stat(120, 'prey'), w.stat(120, 'pred'), w.stat(120, 'predCulled')]).toEqual(ref.get(120))
  })

  it('refuses an action at an hour no checkpoint reaches instead of applying it later', () => {
    const saved = new Sim(params, 7, dist)
    while (saved.tick < 100) saved.step()
    const posts: FromWorker[] = []
    const core = new SimCore(m => posts.push(m))
    core.handle({ type: 'restore', runId: 2, state: saved.save() })
    core.handle({ type: 'advance', runId: 2, target: 110 })
    core.handle({ type: 'intervene', runId: 2, action: 'cullPred', at: 90 })
    const reply = posts.at(-1)
    if (reply?.type !== 'intervened') throw new Error('no reply')
    expect(reply.from).toBeGreaterThan(100)
    expect([reply.tick - reply.from, reply.stats[STAT.predCulled]]).toEqual([0, 0])
  })
})
