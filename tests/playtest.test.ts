import { describe, expect, it } from 'vitest'
import { scoreWords, traitValue, usesLeft } from '@/game/insights'
import { scoreRun } from '@/game/scores'

describe('intervention allowance in words', () => {
  it('states the cap before the run and what is left during it', () => {
    expect(usesLeft(4, 4, true)).toBe('4 uses per run')
    expect(usesLeft(3, 4, false)).toBe('3 of 4 uses left')
    expect(usesLeft(0, 4, false)).toBe('none of 4 uses left')
  })
})

describe('score breakdown in words', () => {
  it('adds hours, budget bonus and calm bonus for a full year', () => {
    expect(scoreWords(scoreRun(8760, true, 0, 4), true, false, 4)).toBe(
      'Score 9,060 = 8,760 hours survived (one point per hour) + 300 budget bonus (10 per unspent point) + 0 calm bonus (400 with no interventions, 100 less for each; 4 interventions used).')
    expect(scoreWords(scoreRun(8760, true, 8, 1), true, false, 1)).toBe(
      'Score 9,280 = 8,760 hours survived (one point per hour) + 220 budget bonus (10 per unspent point) + 300 calm bonus (400 with no interventions, 100 less for each; 1 intervention used).')
  })
  it('explains why a collapse or an Endless run scores hours only', () => {
    expect(scoreWords(scoreRun(2622, false, 0, 3), false, true, 3)).toBe('Score 2,622 = 2,622 hours survived (one point per hour). In Endless the score is hours survived only.')
    expect(scoreWords(scoreRun(4000, false, 0, 3), false, false, 3)).toBe(
      'Score 4,000 = 4,000 hours survived (one point per hour). The budget and calm bonuses count only when both species last the full year.')
  })
})

describe('trait headline', () => {
  const trait = (mean: number) => ({ mean, low: mean, high: mean })
  const pop = (count: number, mean: number) => ({ count, generation: 3, lineages: 1, neurons: 0, traits: { forage: trait(mean), flee: trait(0), cruise: trait(0), hide: trait(0) } })
  it('shows the mean while animals live and "none alive" after extinction', () => {
    expect(traitValue(pop(12, 0.617), 'forage')).toBe('0.62')
    expect(traitValue(pop(0, 0), 'forage')).toBe('none alive')
    expect(traitValue(undefined, 'forage')).toBe('—')
  })
})
