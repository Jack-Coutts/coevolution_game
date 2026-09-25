import type { Species } from '@/sim/species'
import type { FrameData } from '@/worker/protocol'

/** How each species is named and coloured in the interface. One place, so every view agrees. */
export const SPECIES_UI: Record<Species, {
  /** "Rabbit" */
  name: string
  /** "rabbits" */
  plural: string
  /** "Rabbits" */
  Plural: string
  /** "a rabbit" */
  one: string
  text: string
  bg: string
  stroke: string
  fill: string
}> = {
  prey: { name: 'Rabbit', plural: 'rabbits', Plural: 'Rabbits', one: 'a rabbit', text: 'text-rabbit', bg: 'bg-rabbit', stroke: 'stroke-rabbit', fill: 'fill-rabbit' },
  pred: { name: 'Fox', plural: 'foxes', Plural: 'Foxes', one: 'a fox', text: 'text-fox', bg: 'bg-fox', stroke: 'stroke-fox', fill: 'fill-fox' },
  vole: { name: 'Vole', plural: 'voles', Plural: 'Voles', one: 'a vole', text: 'text-vole', bg: 'bg-vole', stroke: 'stroke-vole', fill: 'fill-vole' },
}

const EMPTY = new Float32Array()

/** The packed animals of one species in a frame (empty when the species is absent). */
export function framePop(f: FrameData, s: Species): Float32Array {
  return s === 'prey' ? f.prey : s === 'pred' ? f.preds : (f.voles ?? EMPTY)
}

/** Plant eaters first, then the hunter: rabbits, voles, foxes. */
export function displayOrder(species: readonly Species[]): Species[] {
  return (['prey', 'vole', 'pred'] as const).filter(s => species.includes(s))
}

/** "rabbits and foxes", or "rabbits, voles and foxes". */
export function speciesPhrase(species: readonly Species[]): string {
  const names = displayOrder(species).map(s => SPECIES_UI[s].plural)
  return names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}
