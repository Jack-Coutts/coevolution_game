import type { RunHistory } from './history'
import type { RunConfig } from './controller'
import type { Sim, Intervention } from '@/sim/sim'
import type { EvolutionSample, JournalEntry } from '@/sim/evolution'

export interface MeadowSave {
  version: 2
  savedAt: string
  config: RunConfig
  state: ReturnType<Sim['save']>
  history: ReturnType<RunHistory['save']>
  charges: number
  cooldownUntil: number
  interventions: { tick: number; action: Intervention }[]
  evolution: EvolutionSample[]
  journal: JournalEntry[]
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
        const value = req.result as MeadowSave | undefined
        if (value && (value.version !== 2 || value.state.version !== 2)) reject(new Error('This save belongs to another game version.'))
        else resolve(value ?? null)
      }
      req.onerror = () => reject(req.error)
    })
  } finally { db.close() }
}
