import { benchmarkParams, type Rules, type SimParams, type SpeciesParams } from './params'
import { formatHours } from './time'

export type LeverGroup = 'populations' | 'lifecycle' | 'energy' | 'movement' | 'food' | 'evolution'
export type LeverUnit = 'count' | 'hours' | 'energy' | 'perHour' | 'mult' | 'percent'
export type LeverSpecies = 'prey' | 'pred' | null

export interface LeverDef {
  id: string
  group: LeverGroup
  species: LeverSpecies
  label: string
  hint: string
  min: number
  max: number
  step: number
  unit: LeverUnit
  /** Which direction makes the ecosystem "stronger" and therefore costs points. 0 = free. */
  boost: 1 | -1 | 0
  /** Points per step in the boost direction. The other direction refunds half. */
  cost: number
  rules: 'both' | Rules
}

export type LeverValues = Record<string, number>

export const BUDGET = 30

function species(
  s: 'prey' | 'pred',
  name: string,
): LeverDef[] {
  const prey = s === 'prey'
  return [
    {
      id: `${s}.adultAge`,
      group: 'lifecycle',
      species: s,
      label: 'First birth age',
      hint: `How old a ${name} must be before it can breed.`,
      min: 40,
      max: 200,
      step: 10,
      unit: 'hours',
      boost: -1,
      cost: 1,
      rules: 'both',
    },
    {
      id: `${s}.birthGap`,
      group: 'lifecycle',
      species: s,
      label: 'Birth gap',
      hint: 'Rest between litters. Bigger litters lengthen it by half per extra young.',
      min: 60,
      max: 400,
      step: 10,
      unit: 'hours',
      boost: -1,
      cost: 1,
      rules: 'both',
    },
    {
      id: `${s}.litter`,
      group: 'lifecycle',
      species: s,
      label: 'Litter size',
      hint: 'Young per birth. Each one costs the parent child energy, and the gap grows.',
      min: 1,
      max: 4,
      step: 1,
      unit: 'count',
      boost: 1,
      cost: 4,
      rules: 'both',
    },
    {
      id: `${s}.lifespan`,
      group: 'lifecycle',
      species: s,
      label: 'Lifespan',
      hint: 'Age at which it dies of old age.',
      min: 300,
      max: 1200,
      step: 20,
      unit: 'hours',
      boost: 1,
      cost: 1,
      rules: 'both',
    },
    {
      id: `${s}.breedEnergy`,
      group: 'lifecycle',
      species: s,
      label: 'Breed threshold',
      hint: 'Energy (share of max) a parent needs before it can breed.',
      min: 0.4,
      max: 0.95,
      step: 0.05,
      unit: 'percent',
      boost: -1,
      cost: 1,
      rules: 'energy',
    },
    {
      id: `${s}.childEnergy`,
      group: 'lifecycle',
      species: s,
      label: 'Child energy',
      hint: 'Energy (share of max) the parent hands to each newborn.',
      min: 0.15,
      max: 0.6,
      step: 0.05,
      unit: 'percent',
      boost: 0,
      cost: 0,
      rules: 'energy',
    },
    {
      id: `${s}.mealsToBreed`,
      group: 'lifecycle',
      species: s,
      label: 'Meals to breed',
      hint: 'Meals needed since its last birth.',
      min: 1,
      max: 5,
      step: 1,
      unit: 'count',
      boost: -1,
      cost: 4,
      rules: 'classic',
    },
    {
      id: `${s}.starve`,
      group: 'lifecycle',
      species: s,
      label: 'Starvation time',
      hint: 'Hours without a meal before it starves. Faster, longer-sighted animals starve sooner.',
      min: 60,
      max: 300,
      step: 10,
      unit: 'hours',
      boost: 1,
      cost: 1,
      rules: 'classic',
    },
    {
      id: `${s}.maxEnergy`,
      group: 'energy',
      species: s,
      label: 'Max energy',
      hint: 'Size of the energy tank. The breed threshold and child energy scale with it.',
      min: prey ? 50 : 80,
      max: prey ? 250 : 400,
      step: 10,
      unit: 'energy',
      boost: 1,
      cost: 1,
      rules: 'energy',
    },
    {
      id: `${s}.metabolism`,
      group: 'energy',
      species: s,
      label: 'Metabolism',
      hint: 'Energy burned every hour just staying alive.',
      min: 0.1,
      max: 0.8,
      step: 0.05,
      unit: 'perHour',
      boost: -1,
      cost: 2,
      rules: 'energy',
    },
    {
      id: `${s}.speedCost`,
      group: 'energy',
      species: s,
      label: 'Speed cost',
      hint: 'Extra energy per hour at the benchmark top speed. Grows with speed squared.',
      min: 0.2,
      max: 1.5,
      step: 0.05,
      unit: 'perHour',
      boost: -1,
      cost: 1,
      rules: 'energy',
    },
    {
      id: `${s}.mealEnergy`,
      group: 'energy',
      species: s,
      label: prey ? 'Energy per berry' : 'Energy per rabbit',
      hint: prey ? 'Energy one bite of a bush gives.' : 'Energy one kill gives.',
      min: prey ? 10 : 30,
      max: prey ? 80 : 200,
      step: 5,
      unit: 'energy',
      boost: 1,
      cost: 1,
      rules: 'energy',
    },
    {
      id: `${s}.speed`,
      group: 'movement',
      species: s,
      label: 'Max speed',
      hint: 'Top speed versus the benchmark. Faster costs energy (or starves sooner in classic).',
      min: 0.6,
      max: 1.5,
      step: 0.05,
      unit: 'mult',
      boost: 1,
      cost: 2,
      rules: 'both',
    },
    {
      id: `${s}.sense`,
      group: 'movement',
      species: s,
      label: 'Sense range',
      hint: prey
        ? 'How far a rabbit spots a fox. Vision costs energy upkeep.'
        : 'How far a fox can see rabbits (its view gene maps into this span). Vision costs upkeep.',
      min: 0.5,
      max: 2,
      step: 0.1,
      unit: 'mult',
      boost: 1,
      cost: 1,
      rules: 'both',
    },
    {
      id: `${s}.turn`,
      group: 'movement',
      species: s,
      label: 'Turning',
      hint: 'How sharply it can turn in one hour.',
      min: 0.5,
      max: 1.5,
      step: 0.1,
      unit: 'mult',
      boost: 1,
      cost: 1,
      rules: 'both',
    },
  ]
}

export const LEVERS: LeverDef[] = [
  {
    id: 'prey.initial',
    group: 'populations',
    species: 'prey',
    label: 'Starting rabbits',
    hint: 'Founders with random genes. Only some find food in time.',
    min: 10,
    max: 120,
    step: 5,
    unit: 'count',
    boost: 1,
    cost: 1,
    rules: 'both',
  },
  {
    id: 'pred.initial',
    group: 'populations',
    species: 'pred',
    label: 'Starting foxes',
    hint: 'Founding foxes with random genes.',
    min: 2,
    max: 30,
    step: 1,
    unit: 'count',
    boost: 1,
    cost: 1,
    rules: 'both',
  },
  {
    id: 'prey.cap',
    group: 'populations',
    species: 'prey',
    label: 'Rabbit cap',
    hint: 'No rabbit is born while the warren is this full.',
    min: 40,
    max: 300,
    step: 10,
    unit: 'count',
    boost: 1,
    cost: 1,
    rules: 'both',
  },
  {
    id: 'pred.cap',
    group: 'populations',
    species: 'pred',
    label: 'Fox cap',
    hint: 'No fox is born while there are this many foxes.',
    min: 4,
    max: 80,
    step: 2,
    unit: 'count',
    boost: 1,
    cost: 1,
    rules: 'both',
  },
  ...species('prey', 'rabbit'),
  ...species('pred', 'fox'),
  {
    id: 'food.patches',
    group: 'food',
    species: null,
    label: 'Berry bushes',
    hint: 'Number of bushes, spread across the meadow.',
    min: 4,
    max: 24,
    step: 1,
    unit: 'count',
    boost: 1,
    cost: 2,
    rules: 'both',
  },
  {
    id: 'food.stock',
    group: 'food',
    species: null,
    label: 'Berries per bush',
    hint: 'Most berries a bush can hold.',
    min: 10,
    max: 60,
    step: 5,
    unit: 'count',
    boost: 1,
    cost: 1,
    rules: 'both',
  },
  {
    id: 'food.regrow',
    group: 'food',
    species: null,
    label: 'Regrowth',
    hint: 'Every bush regrows one berry this often.',
    min: 3,
    max: 40,
    step: 1,
    unit: 'hours',
    boost: -1,
    cost: 2,
    rules: 'both',
  },
  {
    id: 'evo.mutation',
    group: 'evolution',
    species: null,
    label: 'Mutation rate',
    hint: 'Chance that each gene of a newborn mutates. High adapts fast but breaks good behaviour.',
    min: 0,
    max: 0.4,
    step: 0.02,
    unit: 'percent',
    boost: 0,
    cost: 0,
    rules: 'both',
  },
]

export const LEVER_BY_ID: Record<string, LeverDef> = Object.fromEntries(LEVERS.map((l) => [l.id, l]))

export const GROUPS: { id: LeverGroup; label: string; blurb: string }[] = [
  { id: 'populations', label: 'Populations', blurb: 'Who starts in the meadow, and how crowded it may get.' },
  { id: 'lifecycle', label: 'Life cycle', blurb: 'When animals breed, how often, and how long they live.' },
  { id: 'energy', label: 'Energy', blurb: 'The fuel tank: what living, moving and eating are worth.' },
  { id: 'movement', label: 'Senses & movement', blurb: 'How fast they run, how far they see, how sharply they turn.' },
  { id: 'food', label: 'Food', blurb: 'The berry bushes rabbits graze.' },
  { id: 'evolution', label: 'Evolution', blurb: 'How quickly genes change between parent and child.' },
]

export function leversFor(rules: Rules): LeverDef[] {
  return LEVERS.filter((l) => l.rules === 'both' || l.rules === rules)
}

function speciesValues(prefix: string, sp: SpeciesParams): LeverValues {
  return {
    [`${prefix}.initial`]: sp.initial,
    [`${prefix}.cap`]: sp.cap,
    [`${prefix}.adultAge`]: sp.adultAge,
    [`${prefix}.birthGap`]: sp.birthGap,
    [`${prefix}.litter`]: sp.litter,
    [`${prefix}.lifespan`]: sp.lifespan,
    [`${prefix}.breedEnergy`]: sp.breedEnergy,
    [`${prefix}.childEnergy`]: sp.childEnergy,
    [`${prefix}.mealsToBreed`]: sp.mealsToBreed,
    [`${prefix}.starve`]: sp.starve,
    [`${prefix}.maxEnergy`]: sp.maxEnergy,
    [`${prefix}.metabolism`]: sp.metabolism,
    [`${prefix}.speedCost`]: sp.speedCost,
    [`${prefix}.mealEnergy`]: sp.mealEnergy,
    [`${prefix}.speed`]: 1,
    [`${prefix}.sense`]: 1,
    [`${prefix}.turn`]: 1,
  }
}

/** Lever values that reproduce the benchmark world. */
export function benchmarkLevers(): LeverValues {
  const p = benchmarkParams()
  return {
    ...speciesValues('prey', p.prey),
    ...speciesValues('pred', p.pred),
    'food.patches': p.patches,
    'food.stock': p.patchStock,
    'food.regrow': p.regrowEvery,
    'evo.mutation': p.mutationRate,
  }
}

function applySpecies(sp: SpeciesParams, v: LeverValues, prefix: string, rules: Rules): void {
  const g = (k: string) => v[`${prefix}.${k}`]
  const speed = g('speed')
  const sense = g('sense')
  const turn = g('turn')
  const litter = g('litter')
  sp.initial = g('initial')
  sp.cap = g('cap')
  sp.adultAge = g('adultAge')
  sp.litter = litter
  sp.birthGap = litterGap(g('birthGap'), litter)
  sp.lifespan = g('lifespan')
  sp.breedEnergy = g('breedEnergy')
  sp.childEnergy = g('childEnergy')
  sp.mealsToBreed = g('mealsToBreed')
  sp.starve = rules === 'classic' ? classicStarve(g('starve'), speed, sense) : g('starve')
  sp.maxEnergy = g('maxEnergy')
  sp.metabolism = g('metabolism')
  sp.speedCost = g('speedCost')
  sp.mealEnergy = g('mealEnergy')
  if (speed !== 1) sp.step = sp.baseStep * speed
  if (sense !== 1) sp.view = [sp.view[0] * sense, sp.view[1] * sense]
  if (turn !== 1) sp.turn = [sp.turn[0] * turn, sp.turn[1] * turn]
}

export function litterGap(gap: number, litter: number): number {
  return Math.round(gap * (1 + 0.5 * (litter - 1)))
}

/** Classic rules' built-in cost: moving faster or seeing further makes an animal starve sooner. */
export function classicStarve(starve: number, speed: number, sense: number): number {
  const load = 1 + 0.6 * Math.max(0, speed - 1) + 0.3 * Math.max(0, sense - 1)
  return load === 1 ? starve : Math.round(starve / load)
}

export function deriveParams(v: LeverValues, rules: Rules): SimParams {
  const p = benchmarkParams()
  p.rules = rules
  applySpecies(p.prey, v, 'prey', rules)
  applySpecies(p.pred, v, 'pred', rules)
  p.patches = v['food.patches']
  p.patchStock = v['food.stock']
  p.regrowEvery = v['food.regrow']
  p.mutationRate = v['evo.mutation']
  return p
}

/** Points spent moving from `base` to `v`, for the levers used by `rules`. */
export function leverCost(def: LeverDef, value: number, base: number): number {
  if (def.boost === 0) return 0
  const steps = ((value - base) / def.step) * def.boost
  return steps >= 0 ? steps * def.cost : steps * def.cost * 0.5
}

export function spent(v: LeverValues, base: LeverValues, rules: Rules): number {
  let total = 0
  for (const def of leversFor(rules)) total += leverCost(def, v[def.id], base[def.id])
  return Math.round(total * 10) / 10
}

export function clampLever(def: LeverDef, value: number): number {
  const stepped = def.min + Math.round((value - def.min) / def.step) * def.step
  const clamped = Math.min(def.max, Math.max(def.min, stepped))
  return Math.round(clamped * 1000) / 1000
}

export function formatLever(def: LeverDef, value: number): string {
  switch (def.unit) {
    case 'count':
      return String(Math.round(value))
    case 'hours':
      return formatHours(value)
    case 'energy':
      return String(Math.round(value))
    case 'perHour':
      return `${value.toFixed(2)}/h`
    case 'mult':
      return `${value.toFixed(value * 100 % 10 === 0 ? 1 : 2)}×`
    case 'percent':
      return `${Math.round(value * 100)}%`
    default: {
      const never: never = def.unit
      return String(never)
    }
  }
}
