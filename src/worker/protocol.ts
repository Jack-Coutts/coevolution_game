import type { SimParams } from '@/sim/params'
import type { Disturbance, Intervention } from '@/sim/sim'

/** Per-animal floats in a frame: id, x, y, hx, hy, energy (0..1), maturity (0..1), pace (0..1), in cover (0/1), generation. */
export const ANIMAL_STRIDE = 10

/** Per-tick stats row. */
export const STAT = {
  prey: 0,
  pred: 1,
  stock: 2,
  preyEnergy: 3,
  predEnergy: 4,
  preyPace: 5,
  predPace: 6,
  preyBorn: 7,
  predBorn: 8,
  preyStarved: 9,
  preyEaten: 10,
  preyOld: 11,
  predStarved: 12,
  predOld: 13,
  preySpread: 14,
  predView: 15,
  bushes: 16,
} as const
export const STAT_STRIDE = 17

export const BUSH_STRIDE = 6

export const EVENT_KIND = ['eaten', 'born', 'starved', 'old', 'arrived', 'released', 'culled', 'sprouted', 'withered'] as const
/** Per-event floats: kind index, species (0 prey / 1 pred), x, y. */
export const EVENT_STRIDE = 4

export interface FrameData {
  tick: number
  prey: Float32Array
  preds: Float32Array
  /** Per bush: id, x, y, fullness (0..1), grown (0..1 after sprouting), withering (0..1). */
  bushes: Float32Array
  events: Float32Array
}

export type ToWorker =
  | { type: 'init'; runId: number; params: SimParams; seed: number; disturbance: Disturbance }
  | { type: 'advance'; runId: number; target: number }
  | { type: 'intervene'; runId: number; action: Intervention }

export interface EndInfo {
  tick: number
  survived: boolean
  preyEnd: number
  predEnd: number
}

export type FromWorker =
  | { type: 'ready'; runId: number; cover: [number, number][]; frame: FrameData; stats: Float64Array }
  | { type: 'frames'; runId: number; frames: FrameData[]; stats: Float64Array; head: number; end: EndInfo | null }
  | { type: 'intervened'; runId: number; action: Intervention; tick: number }
