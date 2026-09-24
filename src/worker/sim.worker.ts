/// <reference lib="webworker" />
import { Sim } from '@/sim/sim'
import {
  ANIMAL_STRIDE,
  EVENT_KIND,
  EVENT_STRIDE,
  STAT,
  STAT_STRIDE,
  type EndInfo,
  type FrameData,
  type FromWorker,
  type ToWorker,
} from './protocol'

const ctx = self as unknown as DedicatedWorkerGlobalScope

let sim: Sim | null = null
let runId = 0
/** Wall-clock budget per advance chunk so the worker stays responsive to new messages. */
const CHUNK_MS = 24

function packAnimals(s: Sim, species: 'prey' | 'pred'): Float32Array {
  const pop = species === 'prey' ? s.prey : s.preds
  const sp = species === 'prey' ? s.p.prey : s.p.pred
  const out = new Float32Array(pop.length * ANIMAL_STRIDE)
  for (let i = 0; i < pop.length; i++) {
    const a = pop[i]
    const o = i * ANIMAL_STRIDE
    out[o] = a.id
    out[o + 1] = a.x
    out[o + 2] = a.y
    out[o + 3] = a.hx
    out[o + 4] = a.hy
    out[o + 5] = a.energy / sp.maxEnergy
    out[o + 6] = Math.min(1, a.age / sp.adultAge)
    out[o + 7] = a.pace
  }
  return out
}

function frame(s: Sim): FrameData {
  const events = new Float32Array(s.events.length * EVENT_STRIDE)
  s.events.forEach((e, i) => {
    const o = i * EVENT_STRIDE
    events[o] = EVENT_KIND.indexOf(e.kind)
    events[o + 1] = e.species === 'prey' ? 0 : 1
    events[o + 2] = e.x
    events[o + 3] = e.y
  })
  return {
    tick: s.tick,
    prey: packAnimals(s, 'prey'),
    preds: packAnimals(s, 'pred'),
    stock: Float32Array.from(s.stock),
    events,
  }
}

function writeStats(s: Sim, out: Float64Array, row: number): void {
  const o = row * STAT_STRIDE
  const mean = (arr: { energy: number; pace: number; hunger: number }[], key: 'energy' | 'pace', max: number) =>
    arr.length ? arr.reduce((t, a) => t + a[key], 0) / arr.length / max : 0
  out[o + STAT.prey] = s.prey.length
  out[o + STAT.pred] = s.preds.length
  out[o + STAT.stock] = s.stock.reduce((t, v) => t + v, 0) / (s.p.patchStock * s.stock.length)
  out[o + STAT.preyEnergy] = mean(s.prey, 'energy', s.p.prey.maxEnergy)
  out[o + STAT.predEnergy] = mean(s.preds, 'energy', s.p.pred.maxEnergy)
  out[o + STAT.preyPace] = mean(s.prey, 'pace', 1)
  out[o + STAT.predPace] = mean(s.preds, 'pace', 1)
  const c = s.counters
  out[o + STAT.preyBorn] = c.preyBorn
  out[o + STAT.predBorn] = c.predBorn
  out[o + STAT.preyStarved] = c.preyStarved
  out[o + STAT.preyEaten] = c.preyEaten
  out[o + STAT.preyOld] = c.preyOld
  out[o + STAT.predStarved] = c.predStarved
  out[o + STAT.predOld] = c.predOld
  // mean distance of rabbits from their nearest bush: how spread out the prey are
  let spread = 0
  for (const a of s.prey) {
    let best = Infinity
    for (const [px, py] of s.patches) best = Math.min(best, (px - a.x) ** 2 + (py - a.y) ** 2)
    spread += Math.sqrt(best)
  }
  out[o + STAT.preySpread] = s.prey.length ? spread / s.prey.length : 0
  out[o + STAT.predView] = s.preds.length ? s.preds.reduce((t, a) => t + a.view, 0) / s.preds.length : 0
}

function endInfo(s: Sim): EndInfo | null {
  if (!s.ended) return null
  return { tick: s.tick, survived: s.survived, preyEnd: s.prey.length, predEnd: s.preds.length }
}

function post(msg: FromWorker, transfer: Transferable[]): void {
  ctx.postMessage(msg, transfer)
}

ctx.onmessage = (ev: MessageEvent<ToWorker>) => {
  const msg = ev.data
  switch (msg.type) {
    case 'init': {
      runId = msg.runId
      sim = new Sim(msg.params, msg.seed, msg.disturbance, true)
      const stats = new Float64Array(STAT_STRIDE)
      writeStats(sim, stats, 0)
      const f = frame(sim)
      post({ type: 'ready', runId, patches: sim.patches, frame: f, stats }, [stats.buffer])
      break
    }
    case 'advance': {
      if (!sim || msg.runId !== runId) return
      const s = sim
      const frames: FrameData[] = []
      const rows: Float64Array[] = []
      const t0 = performance.now()
      while (!s.ended && s.tick < msg.target && performance.now() - t0 < CHUNK_MS && frames.length < 4000) {
        s.step()
        frames.push(frame(s))
        const row = new Float64Array(STAT_STRIDE)
        writeStats(s, row, 0)
        rows.push(row)
      }
      const stats = new Float64Array(rows.length * STAT_STRIDE)
      rows.forEach((row, i) => stats.set(row, i * STAT_STRIDE))
      post({ type: 'frames', runId, frames, stats, head: s.tick, end: endInfo(s) }, [stats.buffer])
      break
    }
    case 'intervene': {
      if (!sim || msg.runId !== runId) return
      sim.queue(msg.action)
      post({ type: 'intervened', runId, action: msg.action, tick: sim.tick + 1 }, [])
      break
    }
    default: {
      const never: never = msg
      throw new Error(`unknown message ${String(never)}`)
    }
  }
}
