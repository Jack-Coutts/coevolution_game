import { traits, type Genome } from './brain'
import type { Sim } from './sim'
import { ALL_SPECIES, eatsPlants, type Species } from './species'

export const TRAITS = ['forage', 'flee', 'cruise', 'hide'] as const
export type TraitKey = typeof TRAITS[number]
const cache = new WeakMap<Genome, ReturnType<typeof traits>>()
export function inheritedTraits(brain: Genome, species: Species) {
  let value = cache.get(brain)
  if (!value) { value = traits(brain, eatsPlants(species)); cache.set(brain, value) }
  return value
}
export interface Distribution { mean: number; low: number; high: number }
export interface PopulationEvolution {
  count: number
  generation: number
  lineages: number
  neurons: number
  traits: Record<TraitKey, Distribution>
}
/** One population summary per species; species absent from the meadow have count 0. */
export type EvolutionSample = { tick: number } & Record<Species, PopulationEvolution>
export interface JournalEntry { tick: number; text: string }

export function summarizeEvolution(sim: Sim): EvolutionSample {
  const population = (species: Species): PopulationEvolution => {
    const pop = sim.pops[species]
    const values = pop.map(a => inheritedTraits(a.brain, species))
    const distribution = (key: TraitKey): Distribution => {
      const xs = values.map(t => t[key]).sort((a, b) => a - b)
      return { mean: xs.reduce((a, b) => a + b, 0) / (xs.length || 1),
        low: xs[Math.floor((xs.length - 1) * 0.1)] ?? 0, high: xs[Math.floor((xs.length - 1) * 0.9)] ?? 0 }
    }
    return { count: pop.length, generation: pop.reduce((n, a) => Math.max(n, a.gen), 0),
      lineages: new Set(pop.map(a => a.lineage)).size,
      neurons: pop.reduce((n, a) => n + a.brain.nHid, 0) / (pop.length || 1),
      traits: Object.fromEntries(TRAITS.map(k => [k, distribution(k)])) as Record<TraitKey, Distribution> }
  }
  const sample = { tick: sim.tick } as EvolutionSample
  for (const s of ALL_SPECIES) sample[s] = population(s)
  return sample
}
