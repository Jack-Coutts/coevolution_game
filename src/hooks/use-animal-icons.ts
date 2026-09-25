import { animalIcon } from '@/render/sprites'

let icons: { rabbit: string; fox: string } | null = null

/** Painted once per page load; every view reuses the same data URLs. */
export function useAnimalIcons(): { rabbit: string; fox: string } {
  icons ??= { rabbit: animalIcon('prey', 40), fox: animalIcon('pred', 40) }
  return icons
}
