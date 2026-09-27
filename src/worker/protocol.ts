import type { EvolutionSample } from '@/sim/evolution'
import type { SimParams } from '@/sim/params'
import type { Disturbance, Intervention, MeadowState } from '@/sim/sim'
import { ALL_SPECIES, type Species } from '@/sim/species'

/** Per-animal floats: id, x, y, hx, hy, energy fraction (of its own max), maturity, pace, cover, generation,
 * age, parent, lineage, offspring, sight, turn, hidden units, forage, flee, cruise, hide, illness hours,
 * inherited body size (multiplier, 1 = the species' base body). */
export const ANIMAL_STRIDE = 23
/** Stride of frames saved before body size; `migrateSave` widens them with size 1. */
export const ANIMAL_STRIDE_V3 = 22
/** Index of the inherited body size in an animal's floats. */
export const ANIMAL_SIZE = 22

/** Per-tick stats row. Vole columns are appended after the 23 two-species columns, so those keep their places. */
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
  predCulled: 17,
  ceilingHits: 18,
  preySick: 19,
  predSick: 20,
  preyIllness: 21,
  predIllness: 22,
  vole: 23,
  voleEnergy: 24,
  voleBorn: 25,
  voleStarved: 26,
  voleEaten: 27,
  voleOld: 28,
  voleIllness: 29,
  voleSick: 30,
  /** Grass seed across all tall-grass patches, 0..1 of full. */
  seed: 31,
  /** Wild meadow columns, appended so earlier columns keep their places. */
  stoat: 32,
  stoatEnergy: 33,
  stoatBorn: 34,
  stoatStarved: 35,
  stoatEaten: 36,
  stoatOld: 37,
  deer: 38,
  deerEnergy: 39,
  deerBorn: 40,
  deerStarved: 41,
  deerOld: 42,
  deerCulled: 43,
  /** Hay piles on the meadow now. */
  hay: 44,
  /** Standing tall-grass patches (mowing lowers it for 30 days; sowing raises it). */
  cover: 45,
} as const
export const STAT_STRIDE = 46
/** Stats row width in version-2 saves (two species). */
export const STAT_STRIDE_V2 = 23
/** Stats row width in version-3 saves made before the Wild meadow. */
export const STAT_STRIDE_V3 = 32

export const BUSH_STRIDE = 6

export const EVENT_KIND = ['eaten', 'born', 'starved', 'old', 'arrived', 'released', 'culled', 'sprouted', 'withered', 'illness'] as const
/** Event species codes are indexes into this list (0 prey, 1 pred, 2 vole); plant events use -1. */
export const EVENT_SPECIES = ALL_SPECIES
export const PLANT_EVENT = -1
/** Per-event floats: kind index, species code, x, y. */
export const EVENT_STRIDE = 4

export interface FrameData {
  tick: number
  prey: Float32Array
  preds: Float32Array
  /** Empty in two-species meadows; absent in frames saved by version 2. */
  voles?: Float32Array
  /** Wild meadow animals; absent in frames saved before it. */
  stoats?: Float32Array
  deer?: Float32Array
  /** Per hay pile: id, x, y, fullness (0..1), time left (0..1). Absent when there is none. */
  hay?: Float32Array
  /** Standing tall-grass patches as x, y pairs. Absent in frames saved before mowing and sowing. */
  cover?: Float32Array
  /** Per bush: id, x, y, fullness (0..1), grown (0..1 after sprouting), withering (0..1). */
  bushes: Float32Array
  events: Float32Array
}

export type ToWorker =
  | { type: 'init'; runId: number; params: SimParams; seed: number; disturbance: Disturbance }
  | { type: 'save'; runId: number; at?: number }
  | { type: 'restore'; runId: number; state: MeadowState }
  | { type: 'advance'; runId: number; target: number }
  /** `at` is the hour on screen when the player acted; the worker rewinds to it if it has run ahead. */
  | { type: 'intervene'; runId: number; action: Intervention; at: number }

export interface EndInfo {
  tick: number
  survived: boolean
  preyEnd: number
  predEnd: number
  voleEnd: number
  stoatEnd: number
  deerEnd: number
  /** The species in this meadow; the run ended at the first of them to die out. */
  species: Species[]
}

export type FromWorker =
  | { type: 'saved'; runId: number; state: MeadowState }
  | { type: 'ready'; restored?: boolean; end?: EndInfo | null; evolution: EvolutionSample; runId: number; cover: [number, number][]; frame: FrameData; stats: Float64Array }
  | { type: 'frames'; evolution: EvolutionSample[]; runId: number; frames: FrameData[]; stats: Float64Array; head: number; end: EndInfo | null }
  /** The action was queued at hour `from` and applied in the step to `tick` (`tick === from` when the run had already ended).
   * The frame and stats row are for `tick`; the worker discarded any hours it had computed after `from`. */
  | { type: 'intervened'; runId: number; action: Intervention; tick: number; from: number; frame: FrameData; stats: Float64Array; evolution: EvolutionSample[]; end: EndInfo | null }
