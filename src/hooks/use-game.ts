import { useSyncExternalStore } from 'react'
import { GameController, type Snapshot } from '@/game/controller'

let controller: GameController | null = null

export function getController(): GameController {
  controller ??= new GameController()
  return controller
}

export function useGame(): [GameController, Snapshot] {
  const c = getController()
  const snap = useSyncExternalStore(c.subscribe, c.getSnapshot)
  return [c, snap]
}
