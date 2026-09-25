import { describe, expect, it } from 'vitest'
import { usesLeft } from '@/game/insights'

describe('intervention allowance in words', () => {
  it('states the cap before the run and what is left during it', () => {
    expect(usesLeft(4, 4, true)).toBe('4 uses per run')
    expect(usesLeft(3, 4, false)).toBe('3 of 4 uses left')
    expect(usesLeft(0, 4, false)).toBe('none of 4 uses left')
  })
})
