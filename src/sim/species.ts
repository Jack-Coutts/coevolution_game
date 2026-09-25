import { defaultVole, type SimParams, type SpeciesParams } from './params'

/**
 * Species keys. `prey` and `pred` are kept for rabbits and foxes because they are in saves,
 * lever ids and statistics (docs/third-species.md section 12); the vole is `vole`.
 */
export type Species = 'prey' | 'pred' | 'vole'

/** Every species the engine knows, in simulation order. The order fixes the random streams. */
export const ALL_SPECIES: readonly Species[] = ['prey', 'pred', 'vole']
export const TWO_SPECIES: readonly Species[] = ['prey', 'pred']
export const THREE_SPECIES: readonly Species[] = ['prey', 'pred', 'vole']

/** Plant foods: berries on bushes, and seed heads in tall grass. */
export type PlantFood = 'berries' | 'seed'

/** Who eats what, independent of the numbers. The food web in docs/third-species.md section 4. */
export const FOOD_WEB: Record<Species, {
  /** Animals it hunts, in the order hunts are resolved. */
  eats: Species[]
  /** Plant foods in order of preference. Empty for a hunter. */
  plants: PlantFood[]
  /** Tall grass slows it down. */
  coverSlows: boolean
  name: string
  plural: string
}> = {
  prey: { eats: [], plants: ['berries'], coverSlows: true, name: 'rabbit', plural: 'rabbits' },
  pred: { eats: ['prey', 'vole'], plants: [], coverSlows: true, name: 'fox', plural: 'foxes' },
  vole: { eats: [], plants: ['seed', 'berries'], coverSlows: false, name: 'vole', plural: 'voles' },
}

export function eatsPlants(s: Species): boolean {
  return FOOD_WEB[s].plants.length > 0
}

/** One plant food as a species eats it. */
export interface Diet {
  food: PlantFood
  /** Units removed from the bush or grass patch per bite. */
  bite: number
  /** Energy per bite, as a share of the eater's `mealEnergy`. */
  value: number
}

/** A species as data: what it eats, what it is worth, its body and its population ceiling. */
export interface SpeciesDef {
  key: Species
  eatsPlants: boolean
  /** Hunted species that live in this meadow. */
  eats: Species[]
  diet: Diet[]
  /** Energy a hunter gains from eating one, as a share of the hunter's `mealEnergy`. */
  mealValue: number
  coverSlows: boolean
  body: SpeciesParams
  ceiling: number
}

/** The species living in a meadow with these parameters, in simulation order. */
export function speciesList(p: SimParams): Species[] {
  return [...(p.vole ? THREE_SPECIES : TWO_SPECIES)]
}

/**
 * The species table for a meadow. Every key is filled so lookups stay total; species absent
 * from `speciesList(p)` have no animals and are never stepped.
 */
export function speciesDefs(p: SimParams): Record<Species, SpeciesDef> {
  const present = speciesList(p)
  const vole = p.vole ?? defaultVole()
  const def = (key: Species, body: SpeciesParams, ceiling: number, diet: Diet[], mealValue: number): SpeciesDef => ({
    key,
    eatsPlants: eatsPlants(key),
    eats: FOOD_WEB[key].eats.filter((s) => present.includes(s)),
    diet: diet.filter((d) => FOOD_WEB[key].plants.includes(d.food)),
    mealValue,
    coverSlows: FOOD_WEB[key].coverSlows,
    body,
    ceiling,
  })
  return {
    prey: def('prey', p.prey, p.eco.ceilingPrey, [{ food: 'berries', bite: 1, value: 1 }], 1),
    pred: def('pred', p.pred, p.eco.ceilingPred, [], 1),
    vole: def('vole', vole.body, vole.ceiling, [
      { food: 'seed', bite: vole.bite, value: 1 },
      { food: 'berries', bite: vole.bite, value: vole.berryValue },
    ], vole.mealValue),
  }
}

/** Per-species life and death counts. */
export interface Tally {
  born: number
  starved: number
  eaten: number
  old: number
  illness: number
  culled: number
}

export function emptyTally(): Tally {
  return { born: 0, starved: 0, eaten: 0, old: 0, illness: 0, culled: 0 }
}

/** A record with one value per species. */
export function perSpecies<T>(make: (s: Species) => T): Record<Species, T> {
  return { prey: make('prey'), pred: make('pred'), vole: make('vole') }
}
