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

const HORIZON = 8000
const NOV_1 = tickAt(2)
const DEC_1 = tickAt(3)
const MAR_1 = tickAt(6)
const MAY_1 = tickAt(8)

export const SCENARIOS: Scenario[] = [
  {
    id: 'stable',
    name: 'Stable meadow',
    tagline: 'A tuned balance. Keep it that way.',
    description:
      'The sweep-tuned starting balance. Most meadows survive the year untouched. Your levers can improve it or break it.',
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
    tagline: 'A pack of 14 moves in on 1 November.',
    description:
      'On 1 November, 14 well-fed foxes arrive from the edge of the meadow, and room for 14 more foxes opens up. Can the rabbits absorb the pressure without being eaten out?',
    disturbance: {
      regrow: [],
      metabolism: [],
      arrivals: [{ tick: NOV_1, species: 'pred', count: 14, capBoost: 14 }],
    },
    spans: [],
    markers: [{ tick: NOV_1, label: 'Foxes arrive' }],
  },
  {
    id: 'winter',
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

export const SCENARIO_BY_ID: Record<ScenarioId, Scenario> = Object.fromEntries(
  SCENARIOS.map((s) => [s.id, s]),
) as Record<ScenarioId, Scenario>
