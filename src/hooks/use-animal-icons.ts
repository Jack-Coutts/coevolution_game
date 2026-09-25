import { animalIcon } from '@/render/sprites'
import type { Species } from '@/sim/species'

export interface AnimalIcons { rabbit: string; fox: string; vole: string }

let icons: AnimalIcons | null = null

/** Painted once per page load; every view reuses the same data URLs. */
export function useAnimalIcons(): AnimalIcons {
  icons ??= { rabbit: animalIcon('prey', 40), fox: animalIcon('pred', 40), vole: animalIcon('vole', 40) }
  return icons
}

/** The icon for a species key. */
export function iconFor(icons: AnimalIcons, s: Species): string {
  return s === 'prey' ? icons.rabbit : s === 'pred' ? icons.fox : icons.vole
}
