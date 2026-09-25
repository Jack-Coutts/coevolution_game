/// <reference lib="webworker" />
import { summarizeEvolution, type EvolutionSample } from '@/sim/evolution'
import { Sim } from '@/sim/sim'
import { endInfo, frame, writeStats } from './pack'
import {
  STAT_STRIDE,
  type FrameData,
  type FromWorker,
  type ToWorker,
} from './protocol'

const ctx = self as unknown as DedicatedWorkerGlobalScope

let sim: Sim | null = null
let runId = 0
/** Wall-clock budget per advance chunk so the worker stays responsive to new messages. */
const CHUNK_MS = 24

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
