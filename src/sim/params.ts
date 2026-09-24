export interface SpeciesParams {
  initial: number
  cap: number
  adultAge: number
  birthGap: number
  litter: number
  lifespan: number
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
  /** Reference speed for the speed cost: moving at this step costs exactly `speedCost`. */
  baseStep: number
  view: [number, number]
  turn: [number, number]
}

/** Ecology and evolution settings that are not player levers. */
export interface EcoParams {
  /** Hidden neurons founders start with (0 = a linear brain). */
  hidden: number
  maxHidden: number
  /** Chance per birth that the brain grows one neutral hidden neuron. */
  growRate: number
  memory: boolean
  /** Births need a nearby adult mate; the child's genes cross over from both parents. */
  sexual: boolean
  /** false = frozen-genes control: every newborn gets fresh random genes. */
  heredity: boolean
  mateR: number
  kinR: number
  /** Tall-grass patches that hide rabbits and slow movement. */
  cover: number
  coverR: number
  /** Within this distance a predator still sees prey hidden in cover. */
  coverSight: number
  /** Step multiplier inside cover. */
  coverSlow: number
  /** Energy per hour per hidden neuron. */
  brainUpkeep: number
  /** Technical population ceilings (performance only). */
  ceilingPrey: number
  ceilingPred: number
}

export interface SimParams {
  horizon: number
  patches: number
  patchStock: number
  regrowEvery: number
  /** New bushes per day in spring-summer terms; seasons scale it. */
  sproutPerDay: number
  /** Chance a sprout lands near an existing bush rather than anywhere. */
  seedSpread: number
  /** Hours a bush can stay grazed down (below WITHER_LEVEL of its stock) before it withers. */
  witherHours: number
  /** Technical ceiling on live bushes. */
  maxBushes: number
  patchSpacing: number
  eatR: number
  feedR: number
  birthR: number
  foodScent: number
  wallView: number
  geneInit: number
  mutationRate: number
  mutationSigma: number
  founderEnergy: number
  prey: SpeciesParams
  pred: SpeciesParams
  eco: EcoParams
}

export function defaultEco(): EcoParams {
  return {
    hidden: 4,
    maxHidden: 12,
    growRate: 0.02,
    memory: true,
    sexual: false,
    heredity: true,
    mateR: 0.1,
    kinR: 0.12,
    cover: 0,
    coverR: 0.07,
    coverSight: 0.04,
    coverSlow: 0.75,
    brainUpkeep: 0.01,
    ceilingPrey: 600,
    ceilingPred: 200,
  }
}

/** The world's fixed physics; levers overwrite the tunable parts (see levers.ts). */
export function defaultParams(): SimParams {
  return {
    horizon: 8000,
    patches: 10,
    patchStock: 30,
    regrowEvery: 15,
    sproutPerDay: 2,
    seedSpread: 0.5,
    witherHours: 120,
    maxBushes: 48,
    patchSpacing: 0.15,
    eatR: 0.025,
    feedR: 0.02,
    birthR: 0.02,
    foodScent: 0.3,
    wallView: 0.1,
    geneInit: 1.0,
    mutationRate: 0.1,
    mutationSigma: 0.1,
    founderEnergy: 0.75,
    prey: {
      initial: 30,
      cap: 150,
      adultAge: 80,
      birthGap: 150,
      litter: 1,
      lifespan: 600,
      maxEnergy: 100,
      metabolism: 0.35,
      speedCost: 0.65,
      mealEnergy: 35,
      breedEnergy: 0.7,
      childEnergy: 0.35,
      visionUpkeep: 0.2,
      step: 0.01,
      baseStep: 0.01,
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
      maxEnergy: 160,
      metabolism: 0.35,
      speedCost: 0.65,
      mealEnergy: 90,
      breedEnergy: 0.7,
      childEnergy: 0.4,
      visionUpkeep: 0.2,
      step: 0.014,
      baseStep: 0.014,
      view: [0.1, 1.0],
      turn: [0.2, 0.8],
    },
    eco: defaultEco(),
  }
}
