import type { Disturbance } from './sim'
import { tickAt } from './time'

export type ScenarioId = 'stable' | 'drought' | 'invasion' | 'winter'

export interface Scenario {
  id: ScenarioId
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
const OCT_1 = tickAt(1)
const DEC_1 = tickAt(3)
const MAR_1 = tickAt(6)
const MAY_1 = tickAt(8)

export const SCENARIOS: Scenario[] = [
  {
    id: 'stable',
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
    name: 'Fox invasion',
    tagline: 'A pack of 14 moves in on 1 October.',
    description:
      'On 1 October, 14 well-fed foxes arrive from the edge of the meadow. Can the rabbits absorb the pressure without being eaten out?',
    disturbance: {
      regrow: [],
      metabolism: [],
      arrivals: [{ tick: OCT_1, species: 'pred', count: 14 }],
    },
    spans: [],
    markers: [{ tick: OCT_1, label: 'Foxes arrive' }],
  },
  {
    id: 'winter',
    name: 'Harsh winter',
    tagline: 'December to February: slow regrowth, and cold burns energy.',
    description:
      'From 1 December to 28 February, bushes regrow at 60% speed and every animal burns 15% more energy just staying warm.',
    disturbance: {
      regrow: [{ from: DEC_1, to: MAR_1, factor: 0.6 }],
      metabolism: [{ from: DEC_1, to: MAR_1, factor: 1.15 }],
      arrivals: [],
    },
    spans: [{ from: DEC_1, to: MAR_1, label: 'Harsh winter', tone: 'winter' }],
    markers: [],
  },
]

export const SCENARIO_BY_ID: Record<ScenarioId, Scenario> = Object.fromEntries(
  SCENARIOS.map((s) => [s.id, s]),
) as Record<ScenarioId, Scenario>

/** Seasonal spans in the visible window. Invasions are a one-time event; weather recurs. */
export function visibleSpans(scenario: Scenario, from: number, to: number, endless: boolean): Scenario['spans'] {
  if (!endless) return scenario.spans
  const out: Scenario['spans'] = []
  for (let year = Math.floor(from / 8760); year <= Math.floor(to / 8760); year++)
    for (const span of scenario.spans) out.push({ ...span, from: span.from + year * 8760, to: span.to + year * 8760 })
  return out.filter(s => s.to >= from && s.from <= to)
}
