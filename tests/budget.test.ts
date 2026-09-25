import { describe, expect, it } from 'vitest'
import { chargesAt, nextRenewal, renewalNote, renewalsBetween } from '@/game/budget'

// Season starts (00:00, ticks from 1 Sep 08:00): 1 Dec 2176, 1 Mar 4336, 1 Jun 6544, next 1 Sep 8752, then +8760 a year.
const FOUR = [100, 600, 1100, 1600]

describe('Endless intervention renewal', () => {
  it('renews at each season start, including across year boundaries', () => {
    expect(nextRenewal(0)).toBe(2176)
    expect(nextRenewal(2175)).toBe(2176)
    expect(nextRenewal(2176)).toBe(4336)
    expect(nextRenewal(4336)).toBe(6544)
    expect(nextRenewal(6544)).toBe(8752)
    expect(nextRenewal(8752)).toBe(10936)
    expect(nextRenewal(8760 * 2 + 6544)).toBe(8760 * 2 + 8752)
    expect(renewalsBetween(0, 8760)).toBe(4)
    expect(renewalsBetween(0, 3 * 8760)).toBe(12)
    expect(renewalsBetween(2176, 2176)).toBe(0)
    expect(renewalsBetween(2175, 2176)).toBe(1)
  })

  it('spends one use per intervention and renews one per season, up to four', () => {
    expect(chargesAt([], 0, true)).toBe(4)
    expect(chargesAt([], 100_000, true)).toBe(4)
    expect(chargesAt(FOUR, 2175, true)).toBe(0)
    expect(chargesAt(FOUR, 2176, true)).toBe(1)
    expect(chargesAt(FOUR, 4336, true)).toBe(2)
    expect(chargesAt(FOUR, 6544, true)).toBe(3)
    expect(chargesAt(FOUR, 8752, true)).toBe(4)
    expect(chargesAt(FOUR, 10936, true)).toBe(4)
    expect(chargesAt([...FOUR, 2176, 4336], 4336, true)).toBe(0)
  })

  it('counts a renewal for a use at the same hour, and loses one that arrives while full', () => {
    expect(chargesAt([2175], 2175, true)).toBe(3)
    expect(chargesAt([2175], 2176, true)).toBe(4)
    expect(chargesAt([2176], 2176, true)).toBe(3)
    expect(chargesAt([...FOUR, 2176], 2176, true)).toBe(0)
    expect(chargesAt([...FOUR, 2176], 4335, true)).toBe(0)
  })

  it('ignores uses after the hour asked about and the order they are listed in', () => {
    expect(chargesAt(FOUR, 700, true)).toBe(2)
    expect(chargesAt([1600, 100, 1100, 600], 2176, true)).toBe(1)
  })

  it('keeps the one-year challenge at four uses for the year', () => {
    expect(chargesAt([], 8760, false)).toBe(4)
    expect(chargesAt([100], 8000, false)).toBe(3)
    expect(chargesAt(FOUR, 2176, false)).toBe(0)
    expect(chargesAt(FOUR, 8752, false)).toBe(0)
  })

  it('says when the next use comes back', () => {
    expect(renewalNote(3, 1872)).toBe('+1 use on 1 Dec (in 12 days 16 hours).')
    expect(renewalNote(0, 8752)).toBe('+1 use on 1 Dec (in 3 months 1 day).')
    expect(renewalNote(4, 1872)).toBe('Full: 4 is the most you can hold. The next season starts 1 Dec (in 12 days 16 hours); spend one before then to get it back.')
  })
})
