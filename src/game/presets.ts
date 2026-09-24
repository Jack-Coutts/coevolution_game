import { defaultLevers, type LeverValues } from '@/sim/levers'

/**
 * "Stable meadow": found by the offline sweep (scripts/sweep.ts).
 * Seeds 0-9: 10/10 reach 8,000 ticks. Held-out seeds 100-149: 47/50.
 */
export const STABLE_PRESET: LeverValues = {
  ...defaultLevers(),
  'prey.initial': 100,
  'pred.initial': 9,
  'prey.cap': 190,
  'pred.cap': 12,
  'prey.adultAge': 60,
  'prey.birthGap': 130,
  'prey.litter': 1,
  'prey.lifespan': 840,
  'prey.breedEnergy': 0.65,
  'prey.childEnergy': 0.45,
  'prey.maxEnergy': 180,
  'prey.metabolism': 0.35,
  'prey.speedCost': 0.5,
  'prey.mealEnergy': 55,
  'prey.speed': 1.15,
  'prey.sense': 1,
  'prey.turn': 1,
  'pred.adultAge': 130,
  'pred.birthGap': 200,
  'pred.litter': 1,
  'pred.lifespan': 820,
  'pred.breedEnergy': 0.75,
  'pred.childEnergy': 0.4,
  'pred.maxEnergy': 240,
  'pred.metabolism': 0.35,
  'pred.speedCost': 0.95,
  'pred.mealEnergy': 90,
  'pred.speed': 0.95,
  'pred.sense': 1.3,
  'pred.turn': 1,
  'food.patches': 19,
  'food.stock': 30,
  'food.regrow': 9,
  'food.sprout': 2,
  'evo.mutation': 0.1,
}
