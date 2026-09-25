import type { Intervention } from '@/sim/sim'
/** Blurbs state the use and the risk measured in docs/validation.md ("Does intervention help?"). */
export const ACTIONS: { id: Intervention; label: string; blurb: string }[] = [
  { id: 'rain', label: 'Rain', blurb: 'Refill every bush now, saving stripped bushes from withering. In a rabbit boom it mainly feeds the next fox boom.' },
  { id: 'plantBushes', label: 'Plant bushes', blurb: 'Plant four half-stocked bushes. Slow food support when bushes are few; little use when the meadow is already full of them.' },
  { id: 'releasePrey', label: 'Release rabbits', blurb: 'Add eight rabbits near food, descended from living rabbits. Helps a scarce warren; in a boom it mostly feeds foxes.' },
  { id: 'releasePred', label: 'Release foxes', blurb: 'Add three fed foxes at the edge. Meant for when only a few foxes remain; adds hunting pressure when foxes are many.' },
  { id: 'cullPred', label: 'Cull foxes', blurb: 'Remove a third of foxes now, leaving at least one. For foxes overhunting falling rabbits; foxes regrow within weeks.' },
  { id: 'feedFoxes', label: 'Feed foxes', blurb: 'Refill fox energy. Tides a few foxes over, but fed foxes breed: during overhunting, rabbits fall further.' },
  { id: 'illnessPrey', label: 'Rabbit illness', blurb: 'Infect up to six rabbits. It sweeps through a crowded warren within days, killing many and starving foxes. Can wipe out a small warren.' },
  { id: 'illnessPred', label: 'Fox illness', blurb: 'Infect up to six foxes. It peaks within about a week, then fades; slower than a cull but thins foxes further. Can wipe out a small group.' },
]
