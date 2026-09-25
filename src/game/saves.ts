import { HISTORY_HOURS, type RunHistory } from './history'
import type { RunConfig } from './controller'
import { migrateState, type Intervention, type MeadowState, type MeadowStateV2 } from '@/sim/sim'
import type { EvolutionSample, PopulationEvolution } from '@/sim/evolution'
import { TRAITS } from '@/sim/evolution'
import { STAT_STRIDE, STAT_STRIDE_V2 } from '@/worker/protocol'
import type { JournalEntry } from './journal'

export const SAVE_VERSION = 3
export const INCOMPATIBLE_SAVE = 'This save belongs to another game version.'

export interface MeadowSave {
  version: 3
  savedAt: string
  config: RunConfig
  state: MeadowState
  history: ReturnType<RunHistory['save']>
  /** Uses left when saved. Written for older builds; on resume, uses are recomputed from `interventions`. */
  charges?: number
  /** The fields below may be missing from early version-2 saves; resume treats them as empty. */
  cooldownUntil?: number
  interventions?: { tick: number; action: Intervention }[]
  evolution?: EvolutionSample[]
  /** Journal entries, also kept (with the journal's state) in `history.journal`; older builds read them from here. */
  journal?: (JournalEntry | { tick: number; text: string })[]
}

/** A version-2 save: a two-species meadow with a 23-column stats row. */
export interface MeadowSaveV2 extends Omit<MeadowSave, 'version' | 'state' | 'history' | 'evolution'> {
  version: 2
  state: MeadowStateV2
  history: Omit<ReturnType<RunHistory['save']>, 'highestGeneration' | 'replayFrom' | 'journal' | 'families' | 'varieties'> & { highestGeneration?: { prey: number; pred: number }; replayFrom?: number }
    & Partial<Pick<ReturnType<RunHistory['save']>, 'journal' | 'families'>>
  evolution?: Omit<EvolutionSample, 'vole'>[]
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
    if (value.version === 3 && value.state.version === 3 && value.history.stats.length === ROWS * STAT_STRIDE) return value
    if (value.version !== 2 || value.state.version !== 2 || value.history.stats.length !== ROWS * STAT_STRIDE_V2)
      throw new Error(INCOMPATIBLE_SAVE)
    const state = migrateState(value.state)
    const stats = new Float64Array(ROWS * STAT_STRIDE)
    for (let r = 0; r < ROWS; r++)
      stats.set(value.history.stats.subarray(r * STAT_STRIDE_V2, (r + 1) * STAT_STRIDE_V2), r * STAT_STRIDE)
    return {
      ...value,
      version: 3,
      state,
      history: { ...value.history, journal: value.history.journal, families: value.history.families, varieties: undefined, replayFrom: value.history.replayFrom ?? value.history.start, stats, highestGeneration: { prey: 0, pred: 0, ...value.history.highestGeneration, vole: 0 } },
      evolution: (value.evolution ?? []).map(e => ({ ...e, vole: noAnimals() })),
    }
  } catch {
    throw new Error(INCOMPATIBLE_SAVE)
  }
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
