import { inheritedTraits, summarizeEvolution, type EvolutionSample } from '@/sim/evolution'
import { Sim, type Intervention } from '@/sim/sim'
import {
  ANIMAL_STRIDE,
  BUSH_STRIDE,
  EVENT_KIND,
  EVENT_STRIDE,
  STAT,
  STAT_STRIDE,
  type EndInfo,
  type FrameData,
  type FromWorker,
  type ToWorker,
} from './protocol'

/** Wall-clock budget per advance chunk so the worker stays responsive to new messages. */
const CHUNK_MS = 24
/** Checkpoint spacing. The worker runs ahead of the displayed hour, so an intervention rewinds to the newest checkpoint at or before that hour and re-steps from there. */
export const CHECKPOINT_EVERY = 24
/** Enough checkpoints to cover how far the simulation can lead the display at the fastest speed. */
const CHECKPOINTS_KEPT = 24

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

function writeStats(s: Sim, out: Float64Array, row: number): void {
  const o = row * STAT_STRIDE
  const mean = (arr: { energy: number; pace: number; hunger: number }[], key: 'energy' | 'pace', max: number) =>
    arr.length ? arr.reduce((t, a) => t + a[key], 0) / arr.length / max : 0
  out[o + STAT.prey] = s.prey.length
  out[o + STAT.pred] = s.preds.length
  out[o + STAT.stock] = s.bushes.reduce((t, b) => t + b.stock, 0) / (s.p.patchStock * Math.max(1, s.bushes.length))
  out[o + STAT.bushes] = s.bushes.length
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
  out[o + STAT.predCulled] = c.predCulled
  out[o + STAT.ceilingHits] = s.ceilingHits
  out[o + STAT.preySick] = s.prey.filter(a => a.illUntil > s.tick).length
  out[o + STAT.predSick] = s.preds.filter(a => a.illUntil > s.tick).length
  out[o + STAT.preyIllness] = c.preyIllness
  out[o + STAT.predIllness] = c.predIllness
  // mean distance of rabbits from their nearest bush: how spread out the prey are
  let spread = 0
  for (const a of s.prey) {
    let best = Infinity
    for (const b of s.bushes) best = Math.min(best, (b.x - a.x) ** 2 + (b.y - a.y) ** 2)
    spread += Math.sqrt(best)
  }
  out[o + STAT.preySpread] = s.prey.length ? spread / s.prey.length : 0
  out[o + STAT.predView] = s.preds.length ? s.preds.reduce((t, a) => t + a.view, 0) / s.preds.length : 0
}

function endInfo(s: Sim): EndInfo | null {
  if (!s.ended) return null
  return { tick: s.tick, survived: s.survived, preyEnd: s.prey.length, predEnd: s.preds.length }
}

function statsRow(s: Sim): Float64Array {
  const row = new Float64Array(STAT_STRIDE)
  writeStats(s, row, 0)
  return row
}

export type Post = (msg: FromWorker, transfer: Transferable[]) => void

/** The worker's message handling, kept free of worker globals so tests can drive it directly. */
export class SimCore {
  private sim: Sim | null = null
  private runId = 0
  private checkpoints: ReturnType<Sim['save']>[] = []
  private readonly post: Post

  constructor(post: Post) {
    this.post = post
  }

  handle(msg: ToWorker): void {
    switch (msg.type) {
      case 'init': {
        this.runId = msg.runId
        this.sim = new Sim(msg.params, msg.seed, msg.disturbance, { record: true })
        this.checkpoints = []
        this.checkpoint()
        const stats = statsRow(this.sim)
        this.post({ type: 'ready', evolution: summarizeEvolution(this.sim), runId: this.runId, cover: this.sim.cover, frame: frame(this.sim), stats }, [stats.buffer])
        break
      }
      case 'save': {
        if (this.sim && msg.runId === this.runId) this.post({ type: 'saved', runId: this.runId, state: this.sim.save() }, [])
        break
      }
      case 'restore': {
        this.runId = msg.runId
        this.sim = Sim.restore(msg.state)
        this.checkpoints = []
        this.checkpoint()
        const stats = statsRow(this.sim)
        this.post({ type: 'ready', restored: true, end: endInfo(this.sim), evolution: summarizeEvolution(this.sim), runId: this.runId,
          cover: this.sim.cover, frame: frame(this.sim), stats }, [stats.buffer])
        break
      }
      case 'advance': {
        const s = this.sim
        if (!s || msg.runId !== this.runId) return
        const frames: FrameData[] = []
        const rows: Float64Array[] = []
        const evolution: EvolutionSample[] = []
        const t0 = performance.now()
        while (!s.ended && s.tick < msg.target && performance.now() - t0 < CHUNK_MS && frames.length < 4000) {
          s.step()
          if (s.tick % 24 === 0 || s.ended) evolution.push(summarizeEvolution(s))
          frames.push(frame(s))
          rows.push(statsRow(s))
          if (s.tick % CHECKPOINT_EVERY === 0) this.checkpoint()
        }
        const stats = new Float64Array(rows.length * STAT_STRIDE)
        rows.forEach((row, i) => stats.set(row, i * STAT_STRIDE))
        this.post({ type: 'frames', evolution, runId: this.runId, frames, stats, head: s.tick, end: endInfo(s) }, [stats.buffer])
        break
      }
      case 'intervene': {
        if (!this.sim || msg.runId !== this.runId) return
        this.intervene(msg.action, msg.at)
        break
      }
      default: {
        const never: never = msg
        throw new Error(`unknown message ${String(never)}`)
      }
    }
  }

  /**
   * Apply an action at the hour the player is looking at. The simulation usually runs a little ahead of the
   * display, so rewind to that hour (from a checkpoint, deterministically), queue the action, and step one hour
   * so its effect shows at once, even while paused. Hours after `at` that were computed but not yet shown are
   * discarded. Same seed, settings and action hours therefore give the same run.
   */
  private intervene(action: Intervention, at: number): void {
    let s = this.sim as Sim
    if (at < s.tick) {
      const cp = this.checkpoints.findLast(c => c.tick <= at)
      if (cp) {
        s = Sim.restore(cp)
        while (s.tick < at && s.step()) { /* replay the hours the display has already shown */ }
        this.sim = s
        this.checkpoints = this.checkpoints.filter(c => c.tick <= at)
      }
    }
    const from = s.tick
    if (!s.ended) {
      s.queue(action)
      s.step()
    }
    const evolution = s.tick % 24 === 0 || s.ended ? [summarizeEvolution(s)] : []
    const stats = statsRow(s)
    this.post({ type: 'intervened', runId: this.runId, action, tick: s.tick, from, frame: frame(s), stats, evolution, end: endInfo(s) }, [stats.buffer])
  }

  private checkpoint(): void {
    if (!this.sim) return
    this.checkpoints.push(structuredClone(this.sim.save()))
    if (this.checkpoints.length > CHECKPOINTS_KEPT) this.checkpoints.shift()
  }
}
