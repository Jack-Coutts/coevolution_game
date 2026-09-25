import { HISTORY_HOURS, type RunHistory } from './history'
import type { RunConfig } from './controller'
import { migrateState, type Intervention, type MeadowState, type MeadowStateV2 } from '@/sim/sim'
import type { EvolutionSample, JournalEntry, PopulationEvolution } from '@/sim/evolution'
import { TRAITS } from '@/sim/evolution'
import { ALL_SPECIES } from '@/sim/species'
import { ANIMAL_SIZE, ANIMAL_STRIDE, ANIMAL_STRIDE_V3, STAT_STRIDE, STAT_STRIDE_V2, type FrameData } from '@/worker/protocol'

export const SAVE_VERSION = 3
export const INCOMPATIBLE_SAVE = 'This save belongs to another game version.'

export interface MeadowSave {
  version: 3
  savedAt: string
  config: RunConfig
  state: MeadowState
  history: ReturnType<RunHistory['save']>
  charges: number
  cooldownUntil: number
  interventions: { tick: number; action: Intervention }[]
  evolution: EvolutionSample[]
  journal: JournalEntry[]
}

/** A version-2 save: a two-species meadow with a 23-column stats row. */
export interface MeadowSaveV2 extends Omit<MeadowSave, 'version' | 'state' | 'history' | 'evolution'> {
  version: 2
  state: MeadowStateV2
  history: Omit<ReturnType<RunHistory['save']>, 'highestGeneration' | 'animalStride'> & { highestGeneration: { prey: number; pred: number } }
  evolution: Omit<EvolutionSample, 'vole'>[]
}

const ROWS = HISTORY_HOURS + 1

function noAnimals(): PopulationEvolution {
  const none = { mean: 0, low: 0, high: 0 }
  return { count: 0, generation: 0, lineages: 0, neurons: 0, traits: Object.fromEntries(TRAITS.map(k => [k, { ...none }])) as PopulationEvolution['traits'] }
}

/**
 * Bring a stored save to the current version, in memory. Version 2 becomes a two-species
 * version-3 meadow: the state is migrated, stats rows are widened with zero vole columns,
 * and evolution samples gain an empty vole population. Anything else is refused whole.
 */
export function migrateSave(value: MeadowSave | MeadowSaveV2): MeadowSave {
  try {
    if (value.version === 3 && value.state.version === 3 && value.history.stats.length === ROWS * STAT_STRIDE) return withBodySize(value)
    if (value.version !== 2 || value.state.version !== 2 || value.history.stats.length !== ROWS * STAT_STRIDE_V2)
      throw new Error(INCOMPATIBLE_SAVE)
    const state = migrateState(value.state)
    const stats = new Float64Array(ROWS * STAT_STRIDE)
    for (let r = 0; r < ROWS; r++)
      stats.set(value.history.stats.subarray(r * STAT_STRIDE_V2, (r + 1) * STAT_STRIDE_V2), r * STAT_STRIDE)
    return withBodySize({
      ...value,
      version: 3,
      state,
      history: { ...value.history, stats, highestGeneration: { ...value.history.highestGeneration, vole: 0 }, animalStride: ANIMAL_STRIDE_V3 },
      evolution: value.evolution.map(e => ({ ...e, vole: noAnimals() })),
    })
  } catch {
    throw new Error(INCOMPATIBLE_SAVE)
  }
}

/** Widen 22-float animals to the current stride with body size 1. */
function widenAnimals(a: Float32Array): Float32Array {
  const n = a.length / ANIMAL_STRIDE_V3
  if (!Number.isInteger(n)) throw new Error(INCOMPATIBLE_SAVE)
  const out = new Float32Array(n * ANIMAL_STRIDE)
  for (let i = 0; i < n; i++) {
    out.set(a.subarray(i * ANIMAL_STRIDE_V3, (i + 1) * ANIMAL_STRIDE_V3), i * ANIMAL_STRIDE)
    out[i * ANIMAL_STRIDE + ANIMAL_SIZE] = 1
  }
  return out
}

/**
 * Saves from before inherited body size: replay frames gain a size of 1 per animal and
 * evolution samples gain a body-size distribution (1 where animals lived). Current saves pass through.
 */
function withBodySize(save: MeadowSave): MeadowSave {
  const oldFrames = (save.history.animalStride ?? ANIMAL_STRIDE_V3) !== ANIMAL_STRIDE
  const oldSamples = save.evolution.some(e => ALL_SPECIES.some(s => !e[s].traits.size))
  if (!oldFrames && !oldSamples) return save
  const frames = oldFrames
    ? save.history.frames.map(([t, f]): [number, FrameData] => [t, { ...f, prey: widenAnimals(f.prey), preds: widenAnimals(f.preds), ...(f.voles ? { voles: widenAnimals(f.voles) } : {}) }])
    : save.history.frames
  const evolution = save.evolution.map(e => {
    const out = { ...e }
    for (const s of ALL_SPECIES) {
      if (e[s].traits.size) continue
      const v = e[s].count > 0 ? 1 : 0
      out[s] = { ...e[s], traits: { ...e[s].traits, size: { mean: v, low: v, high: v } } }
    }
    return out
  })
  return { ...save, history: { ...save.history, frames, animalStride: ANIMAL_STRIDE }, evolution }
}

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('coevolution-meadows', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('saves')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
export async function writeSave(save: MeadowSave): Promise<void> {
  const db = await database()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('saves', 'readwrite')
      tx.objectStore('saves').put(save, 'meadow')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}
export async function readSave(): Promise<MeadowSave | null> {
  const db = await database()
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction('saves').objectStore('saves').get('meadow')
      req.onsuccess = () => {
        const value = req.result as MeadowSave | MeadowSaveV2 | undefined
        if (!value) { resolve(null); return }
        try { resolve(migrateSave(value)) } catch (error) { reject(error) }
      }
      req.onerror = () => reject(req.error)
    })
  } finally { db.close() }
}
