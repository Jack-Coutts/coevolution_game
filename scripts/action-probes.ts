import type { Intervention, Sim } from '../src/sim/sim'

/** The game's intervention budget. Mirrors src/game/controller.ts, which imports browser-only modules; a test keeps them equal. */
export const CHARGES = 4
export const COOLDOWN = 400

/** What a player can read on screen: counts, berry stock, mean energy, illness and the 10-day trend. */
export interface Signals {
  hour: number
  rabbits: number
  foxes: number
  bushes: number
  /** Mean berry stock as a fraction of a full bush (the "bushes n% full" field note). */
  stock: number
  rabbitEnergy: number
  foxEnergy: number
  illRabbits: number
  illFoxes: number
  /** Fractional change over the last 10 days (240 h), as used by the field notes. */
  rabbitTrend: number
  foxTrend: number
}

const WINDOW = 240

/** Rolling record of counts so trends can be computed exactly as the field notes do. */
export class Watch {
  private prey: number[] = []
  private pred: number[] = []

  observe(s: Sim): Signals {
    this.prey[s.tick] = s.prey.length
    this.pred[s.tick] = s.preds.length
    const past = Math.max(0, s.tick - WINDOW)
    const prey0 = this.prey[past] ?? s.p.prey.initial
    const pred0 = this.pred[past] ?? s.p.pred.initial
    const mean = (xs: { energy: number }[], max: number) => xs.length ? xs.reduce((t, a) => t + a.energy, 0) / (xs.length * max) : 0
    return {
      hour: s.tick,
      rabbits: s.prey.length,
      foxes: s.preds.length,
      bushes: s.bushes.length,
      stock: s.bushes.reduce((t, b) => t + b.stock, 0) / (s.p.patchStock * Math.max(1, s.bushes.length)),
      rabbitEnergy: mean(s.prey, s.p.prey.maxEnergy),
      foxEnergy: mean(s.preds, s.p.pred.maxEnergy),
      illRabbits: s.prey.filter(a => a.illUntil > s.tick).length,
      illFoxes: s.preds.filter(a => a.illUntil > s.tick).length,
      rabbitTrend: prey0 > 0 ? s.prey.length / prey0 - 1 : 0,
      foxTrend: pred0 > 0 ? s.preds.length / pred0 - 1 : 0,
    }
  }
}

export interface ActionProbe {
  action: Intervention
  /** Plain-language description of the situation the action is meant for. */
  situation: string
  timely: (x: Signals) => boolean
  /** A situation where the same action is plausible-looking but wrong, or at best wasted. */
  mistimedSituation: string
  mistimed: (x: Signals) => boolean
}

/** The field notes' "overhunt" warning, with at least ten foxes so a cull removes some. */
const overhunt = (x: Signals) => x.foxes >= 10 && x.rabbits < 5 * x.foxes && x.rabbitTrend < -0.15
const foxHeavy = (x: Signals) => x.foxes >= 20 && x.rabbits < 8 * x.foxes

/**
 * One row per intervention. Thresholds were chosen from 60-day branch outcomes on tuning seeds
 * 8000-8039 only (scripts/action-explore.ts), then frozen before evaluation seeds 8100-8199.
 */
export const PROBES: ActionProbe[] = [
  {
    action: 'rain',
    situation: 'Bushes stripped: 20 or fewer bushes, under 20% full (they wither after ten bare days)',
    timely: x => x.bushes <= 20 && x.stock < 0.2,
    mistimedSituation: 'Rabbit boom with many foxes: 250+ rabbits and 20+ foxes',
    mistimed: x => x.rabbits >= 250 && x.foxes >= 20,
  },
  {
    action: 'plantBushes',
    situation: 'Few bushes: 20 or fewer',
    timely: x => x.bushes <= 20,
    mistimedSituation: 'Meadow already has 40 or more bushes (the limit is 48)',
    mistimed: x => x.bushes >= 40,
  },
  {
    action: 'releasePrey',
    situation: 'Rabbits scarce: 60 or fewer',
    timely: x => x.rabbits <= 60,
    mistimedSituation: 'Rabbit boom with many foxes: 250+ rabbits and 20+ foxes',
    mistimed: x => x.rabbits >= 250 && x.foxes >= 20,
  },
  {
    action: 'releasePred',
    situation: 'Foxes nearly gone: 5 or fewer',
    timely: x => x.foxes <= 5,
    mistimedSituation: 'Fox-heavy meadow: 20+ foxes and fewer than 8 rabbits per fox',
    mistimed: foxHeavy,
  },
  {
    action: 'cullPred',
    situation: 'Overhunting: 10+ foxes, fewer than 5 rabbits per fox, rabbits down 15% in 10 days',
    timely: overhunt,
    mistimedSituation: 'Foxes already scarce: 8 or fewer',
    mistimed: x => x.foxes <= 8,
  },
  {
    action: 'feedFoxes',
    situation: 'Few foxes: 6 or fewer',
    timely: x => x.foxes <= 6,
    mistimedSituation: 'Overhunting: fed foxes breed while rabbits keep falling',
    mistimed: overhunt,
  },
  {
    action: 'illnessPrey',
    situation: 'Rabbit boom on bare bushes: 300+ rabbits, bushes under 20% full (the intended use; no benefit found)',
    timely: x => x.rabbits >= 300 && x.stock < 0.2,
    mistimedSituation: 'Rabbits already scarce: 60 or fewer',
    mistimed: x => x.rabbits <= 60,
  },
  {
    action: 'illnessPred',
    situation: 'Fox-heavy meadow before the crash: 20+ foxes and fewer than 8 rabbits per fox',
    timely: foxHeavy,
    mistimedSituation: 'Foxes already scarce: 8 or fewer',
    mistimed: x => x.foxes <= 8,
  },
]

/** Keeper policy priority: emergencies first, then early warnings, then food. */
export const KEEPER_ORDER: Intervention[] = ['releasePred', 'feedFoxes', 'releasePrey', 'cullPred', 'illnessPred', 'plantBushes', 'rain', 'illnessPrey']

