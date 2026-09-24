export type Rules = 'classic' | 'energy'

export interface SpeciesParams {
  initial: number
  cap: number
  adultAge: number
  birthGap: number
  litter: number
  lifespan: number
  /** Classic rules: meals needed to breed. */
  mealsToBreed: number
  /** Classic rules: ticks without a meal before starving. */
  starve: number
  /** Energy rules. */
  maxEnergy: number
  metabolism: number
  speedCost: number
  mealEnergy: number
  /** Fraction of max energy needed to breed. */
  breedEnergy: number
  /** Fraction of max energy the parent pays into each child. */
  childEnergy: number
  /** Energy per tick per unit of view range. */
  visionUpkeep: number
  /** Max step length per tick. */
  step: number
  /** The benchmark step: the reference speed for the speed cost. */
  baseStep: number
  /** Classic rules only; under energy rules pace always spans 0..1. */
  minPace: number
  view: [number, number]
  turn: [number, number]
}

export interface SimParams {
  rules: Rules
  horizon: number
  patches: number
  patchStock: number
  regrowEvery: number
  patchSpacing: number
  eatR: number
  feedR: number
  birthR: number
  foodScent: number
  wallView: number
  geneInit: number
  mutationRate: number
  mutationSigma: number
  gapFromOwnBirth: boolean
  founderEnergy: number
  prey: SpeciesParams
  pred: SpeciesParams
}

export const PREY_SENSES = 11
export const PRED_SENSES = 11

/** The benchmark world and rules exactly as in coevo.py. */
export function benchmarkParams(): SimParams {
  return {
    rules: 'classic',
    horizon: 8000,
    patches: 10,
    patchStock: 30,
    regrowEvery: 15,
    patchSpacing: 0.15,
    eatR: 0.025,
    feedR: 0.02,
    birthR: 0.02,
    foodScent: 0.3,
    wallView: 0.1,
    geneInit: 1.0,
    mutationRate: 0.1,
    mutationSigma: 0.1,
    gapFromOwnBirth: false,
    founderEnergy: 0.75,
    prey: {
      initial: 30,
      cap: 150,
      adultAge: 80,
      birthGap: 150,
      litter: 1,
      lifespan: 600,
      mealsToBreed: 2,
      starve: 100,
      maxEnergy: 100,
      metabolism: 0.35,
      speedCost: 0.65,
      mealEnergy: 35,
      breedEnergy: 0.7,
      childEnergy: 0.35,
      visionUpkeep: 0.2,
      step: 0.01,
      baseStep: 0.01,
      minPace: 1.0,
      view: [0.2, 0.2],
      turn: [1.0, 1.0],
    },
    pred: {
      initial: 6,
      cap: 40,
      adultAge: 100,
      birthGap: 200,
      litter: 1,
      lifespan: 700,
      mealsToBreed: 2,
      starve: 150,
      maxEnergy: 160,
      metabolism: 0.35,
      speedCost: 0.65,
      mealEnergy: 90,
      breedEnergy: 0.7,
      childEnergy: 0.4,
      visionUpkeep: 0.2,
      step: 0.014,
      baseStep: 0.014,
      minPace: 0.3,
      view: [0.1, 1.0],
      turn: [0.2, 0.8],
    },
  }
}

export function cloneParams(p: SimParams): SimParams {
  return {
    ...p,
    prey: { ...p.prey, view: [...p.prey.view], turn: [...p.prey.turn] },
    pred: { ...p.pred, view: [...p.pred.view], turn: [...p.pred.turn] },
  }
}
