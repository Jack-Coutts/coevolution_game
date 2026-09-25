import type { Intervention } from '@/sim/sim'
import type { Species } from '@/sim/species'
/** Blurbs state the use and the risk measured in docs/validation.md ("Does intervention help?"). */
export const ACTIONS: { id: Intervention; label: string; blurb: string }[] = [
  { id: 'rain', label: 'Rain', blurb: 'Refill every bush now, saving stripped bushes from withering. In a rabbit boom it mainly feeds the next fox boom. Voles eat berries too when grass seed is short.' },
  { id: 'plantBushes', label: 'Plant bushes', blurb: 'Plant four half-stocked bushes. Slow food support when bushes are few; little use when the meadow is already full of them.' },
  { id: 'releasePrey', label: 'Release rabbits', blurb: 'Add eight rabbits near food, descended from living rabbits. Helps a scarce warren; in a boom it mostly feeds foxes.' },
  { id: 'releasePred', label: 'Release foxes', blurb: 'Add three fed foxes at the edge. Meant for when only a few foxes remain; adds hunting pressure when foxes are many.' },
  { id: 'cullPred', label: 'Cull foxes', blurb: 'Remove a third of foxes now, leaving at least one. For foxes overhunting falling rabbits; foxes regrow within weeks.' },
  { id: 'feedFoxes', label: 'Feed foxes', blurb: 'Refill fox energy. Tides a few foxes over, but fed foxes breed: during overhunting, rabbits fall further.' },
  { id: 'illnessPrey', label: 'Rabbit illness', blurb: 'Infect up to six rabbits. It sweeps through a crowded warren within days, killing many and starving foxes. Can wipe out a small warren.' },
  { id: 'illnessPred', label: 'Fox illness', blurb: 'Infect up to six foxes. It peaks within about a week, then fades; slower than a cull but thins foxes further. Can wipe out a small group.' },
]
/** Vole meadow actions (docs/third-species.md section 9), offered only where voles live. */
export const VOLE_ACTIONS: { id: Intervention; label: string; blurb: string }[] = [
  { id: 'releaseVole', label: 'Release voles', blurb: 'Add twelve voles in the tall grass, descended from living voles.' },
  { id: 'illnessVole', label: 'Vole illness', blurb: 'Start illness in up to six voles. Spreads among nearby voles, draining energy for ten days per case.' },
]

/** The actions offered in a meadow: every one whose species lives there, sharing the same budget. */
export function actionsFor(species: readonly Species[]): { id: Intervention; label: string; blurb: string }[] {
  return species.includes('vole') ? [...ACTIONS, ...VOLE_ACTIONS] : ACTIONS
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
/** "eight", "ten": how many options, in words. */
export function optionCount(species: readonly Species[]): string {
  const n = actionsFor(species).length
  return WORDS[n] ?? String(n)
}
