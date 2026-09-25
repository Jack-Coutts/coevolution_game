/// <reference lib="webworker" />
import { inheritedTraits, summarizeEvolution, type EvolutionSample } from '@/sim/evolution'
import { Sim } from '@/sim/sim'
import {
  ANIMAL_STRIDE,
  BUSH_STRIDE,
  EVENT_KIND,
  EVENT_STRIDE,
  STAT_STRIDE,
  type EndInfo,
  type FrameData,
  type FromWorker,
  type ToWorker,
} from './protocol'
import { writeStats } from './stats'

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
    out[o + 8] = a.inCover ? 1 : 0
    out[o + 9] = a.gen
    out[o + 10] = a.age
    out[o + 11] = a.parent
    out[o + 12] = a.lineage
    out[o + 13] = a.kits
    out[o + 14] = a.view
    out[o + 15] = a.maxTurn
    out[o + 16] = a.brain.nHid
    const t = inheritedTraits(a.brain, species)
    out[o + 17] = t.forage
    out[o + 18] = t.flee
    out[o + 19] = t.cruise
    out[o + 20] = t.hide
    out[o + 21] = Math.max(0, a.illUntil - s.tick)
  }
  return out
}

const SPROUT_HOURS = 48

function packBushes(s: Sim): Float32Array {
  const out = new Float32Array(s.bushes.length * BUSH_STRIDE)
  s.bushes.forEach((b, i) => {
    const o = i * BUSH_STRIDE
    out[o] = b.id
    out[o + 1] = b.x
    out[o + 2] = b.y
    out[o + 3] = b.stock / s.p.patchStock
    out[o + 4] = Math.min(1, b.age / SPROUT_HOURS)
    out[o + 5] = b.grazedFor / s.p.witherHours
  })
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
    bushes: packBushes(s),
    events,
  }
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
      sim = new Sim(msg.params, msg.seed, msg.disturbance, { record: true })
      const stats = new Float64Array(STAT_STRIDE)
      writeStats(sim, stats, 0)
      const f = frame(sim)
      post({ type: 'ready', evolution: summarizeEvolution(sim), runId, cover: sim.cover, frame: f, stats }, [stats.buffer])
      break
    }
    case 'save': {
      if (sim && msg.runId === runId) post({ type: 'saved', runId, state: sim.save() }, [])
      break
    }
    case 'restore': {
      runId = msg.runId
      sim = Sim.restore(msg.state)
      const stats = new Float64Array(STAT_STRIDE)
      writeStats(sim, stats, 0)
      post({ type: 'ready', restored: true, end: endInfo(sim), evolution: summarizeEvolution(sim), runId,
        cover: sim.cover, frame: frame(sim), stats }, [stats.buffer])
      break
    }
    case 'advance': {
      if (!sim || msg.runId !== runId) return
      const s = sim
      const frames: FrameData[] = []
      const rows: Float64Array[] = []
      const evolution: EvolutionSample[] = []
      const t0 = performance.now()
      while (!s.ended && s.tick < msg.target && performance.now() - t0 < CHUNK_MS && frames.length < 4000) {
        s.step()
        if (s.tick % 24 === 0 || s.ended) evolution.push(summarizeEvolution(s))
        frames.push(frame(s))
        const row = new Float64Array(STAT_STRIDE)
        writeStats(s, row, 0)
        rows.push(row)
      }
      const stats = new Float64Array(rows.length * STAT_STRIDE)
      rows.forEach((row, i) => stats.set(row, i * STAT_STRIDE))
      post({ type: 'frames', evolution, runId, frames, stats, head: s.tick, end: endInfo(s) }, [stats.buffer])
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
