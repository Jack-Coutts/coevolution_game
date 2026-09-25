import type { Intervention } from '@/sim/sim'
export const ACTIONS: { id: Intervention; label: string; blurb: string }[] = [
  { id: 'rain', label: 'Rain', blurb: 'Refill every bush. Immediate relief, but a rabbit boom can follow.' },
  { id: 'plantBushes', label: 'Plant bushes', blurb: 'Plant four half-stocked bushes. Longer-term food that can still be overgrazed.' },
  { id: 'releasePrey', label: 'Release rabbits', blurb: 'Add eight rabbits near food, descended from living rabbits.' },
  { id: 'releasePred', label: 'Release foxes', blurb: 'Add three fed foxes. More hunting pressure on the rabbits.' },
  { id: 'cullPred', label: 'Cull foxes', blurb: 'Remove a third of foxes immediately, leaving at least one.' },
  { id: 'feedFoxes', label: 'Feed foxes', blurb: 'Refill fox energy. They hunt less briefly, but may breed more.' },
  { id: 'illnessPrey', label: 'Rabbit illness', blurb: 'Start illness in up to six rabbits. Spreads among nearby rabbits, draining energy for ten days per case. Can cause extinction.' },
  { id: 'illnessPred', label: 'Fox illness', blurb: 'Start illness in up to six foxes. Spreads among nearby foxes, draining energy for ten days per case. Slower and less precise than culling.' },
]
/** Vole meadow actions (docs/third-species.md section 9). Not shown until the Vole meadow is playable (#9). */
export const VOLE_ACTIONS: { id: Intervention; label: string; blurb: string }[] = [
  { id: 'releaseVole', label: 'Release voles', blurb: 'Add twelve voles in the tall grass, descended from living voles.' },
  { id: 'illnessVole', label: 'Vole illness', blurb: 'Start illness in up to six voles. Spreads among nearby voles, draining energy for ten days per case.' },
]
