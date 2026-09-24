import { useMemo } from 'react'
import { animalIcon } from '@/render/sprites'

export function useAnimalIcons(): { rabbit: string; fox: string } {
  return useMemo(() => ({ rabbit: animalIcon('prey', 40), fox: animalIcon('pred', 40) }), [])
}
