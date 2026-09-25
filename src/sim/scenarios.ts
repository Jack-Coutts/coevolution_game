import type { Disturbance } from './sim'
import { THREE_SPECIES, TWO_SPECIES, type Species } from './species'
import { tickAt } from './time'

export type ScenarioId = 'stable' | 'drought' | 'invasion' | 'winter' | 'voles'

export interface Scenario {
  id: ScenarioId
  /** The species in this meadow. Every one must survive; the run ends at the first extinction. */
  species: readonly Species[]
  name: string
  tagline: string
  description: string
  disturbance: Disturbance
  /** Shaded spans on the timeline. */
  spans: { from: number; to: number; label: string; tone: 'drought' | 'winter' }[]
  /** Point markers on the timeline. */
  markers: { tick: number; label: string }[]
}

const HORIZON = 8760
const NOV_1 = tickAt(2)
const DEC_1 = tickAt(3)
const MAR_1 = tickAt(6)
const MAY_1 = tickAt(8)

/** Scenarios offered in the picker. The Vole meadow joins in #9. */
export const SCENARIOS: Scenario[] = [
  {
    id: 'stable',
    species: TWO_SPECIES,
    name: 'Open meadow',
    tagline: 'Watch, adapt, and keep both species alive.',
    description:
      'A meadow with room for booms and busts. Read the warning signs and intervene before either species disappears.',
    disturbance: { regrow: [], metabolism: [], arrivals: [] },
    spans: [],
    markers: [],
  },
  {
    id: 'drought',
    species: TWO_SPECIES,
    name: 'Drought',
    tagline: 'From May the bushes barely regrow.',
    description:
      'From 1 May to the end of the run, bushes regrow at 35% of their usual rate. Rabbits must survive the dry months on thin forage, and foxes on thin rabbits.',
    disturbance: { regrow: [{ from: MAY_1, to: HORIZON + 1, factor: 0.35 }], metabolism: [], arrivals: [] },
    spans: [{ from: MAY_1, to: HORIZON, label: 'Drought', tone: 'drought' }],
    markers: [],
  },
  {
    id: 'invasion',
    species: TWO_SPECIES,
    name: 'Fox invasion',
    tagline: 'A pack of 14 moves in on 1 November.',
    description:
      'On 1 November, 14 well-fed foxes arrive from the edge of the meadow. Can the rabbits absorb the pressure without being eaten out?',
    disturbance: {
      regrow: [],
      metabolism: [],
      arrivals: [{ tick: NOV_1, species: 'pred', count: 14 }],
    },
    spans: [],
    markers: [{ tick: NOV_1, label: 'Foxes arrive' }],
  },
  {
    id: 'winter',
    species: TWO_SPECIES,
    name: 'Harsh winter',
    tagline: 'December to February: little food, and cold burns energy.',
    description:
      'From 1 December to 28 February, bushes regrow at 30% speed and every animal burns 35% more energy just staying warm.',
    disturbance: {
      regrow: [{ from: DEC_1, to: MAR_1, factor: 0.3 }],
      metabolism: [{ from: DEC_1, to: MAR_1, factor: 1.35 }],
      arrivals: [],
    },
    spans: [{ from: DEC_1, to: MAR_1, label: 'Harsh winter', tone: 'winter' }],
    markers: [],
  },
]

/**
 * The Vole meadow (docs/third-species.md section 11): the Open meadow preset plus field voles
 * and grass seed, with no weather. Hidden from the scenario picker until #9 makes it playable;
 * scripts and tests reach it through `SCENARIO_BY_ID.voles`.
 */
export const VOLE_MEADOW: Scenario = {
  id: 'voles',
  species: THREE_SPECIES,
  name: 'Vole meadow',
  tagline: 'Keep rabbits, voles and foxes alive for a year.',
  description:
    'Field voles live in the tall grass and eat its seeds, and berries when the seed runs short. Foxes eat them too.',
  disturbance: { regrow: [], metabolism: [], arrivals: [] },
  spans: [],
  markers: [],
}

/** Every scenario, including ones not yet offered in the picker (`SCENARIOS`). */
export const ALL_SCENARIOS: Scenario[] = [...SCENARIOS, VOLE_MEADOW]

export const SCENARIO_BY_ID: Record<ScenarioId, Scenario> = Object.fromEntries(
  ALL_SCENARIOS.map((s) => [s.id, s]),
) as Record<ScenarioId, Scenario>

/** Seasonal spans in the visible window. Invasions are a one-time event; weather recurs. */
export function visibleSpans(scenario: Scenario, from: number, to: number, endless: boolean): Scenario['spans'] {
  if (!endless) return scenario.spans
  const out: Scenario['spans'] = []
  for (let year = Math.floor(from / 8760); year <= Math.floor(to / 8760); year++)
    for (const span of scenario.spans) out.push({ ...span, from: span.from + year * 8760, to: span.to + year * 8760 })
  return out.filter(s => s.to >= from && s.from <= to)
}
