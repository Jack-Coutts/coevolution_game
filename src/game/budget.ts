import { dateLabel, formatDuration, tickAt } from '@/sim/time'

/**
 * The intervention budget. A one-year challenge has four uses for the year. Endless starts with the same four
 * and renews one use at the start of each season (1 Dec, 1 Mar, 1 Jun, 1 Sep), never holding more than four.
 * The cooldown between uses is the same in both modes.
 */
export const CHARGES = 4
export const CHARGE_CAP = 4
export const COOLDOWN = 400

/** Season starts counted in months from the first September: 3 = 1 Dec, 6 = 1 Mar, 9 = 1 Jun, 12 = the next 1 Sep. */
const SEASON_MONTHS = 3

/** The first season start strictly after `tick` (Endless renewals happen at these hours). */
export function nextRenewal(tick: number): number {
  let m = Math.max(1, Math.floor((tick + 8) / 8760) * 12)
  while (tickAt(m) <= tick) m += 1
  while (m % SEASON_MONTHS !== 0) m += 1
  return tickAt(m)
}

/** How many season starts fall in the hours (from, to]. */
export function renewalsBetween(from: number, to: number): number {
  let n = 0
  for (let t = nextRenewal(from); t <= to; t = nextRenewal(t)) n += 1
  return n
}

/**
 * Uses available at hour `tick`, given the hours at which uses were spent. Pure and order-independent, so
 * replay, saving and resuming all give the same answer: a renewal at hour b counts for a use made at b, and the
 * cap applies at each renewal (a renewal while full is lost, as the player was told).
 */
export function chargesAt(spentAt: readonly number[], tick: number, endless: boolean): number {
  let charges = CHARGES
  let prev = 0
  for (const at of [...spentAt].filter(t => t <= tick).sort((a, b) => a - b)) {
    if (endless) charges = Math.min(CHARGE_CAP, charges + renewalsBetween(prev, at))
    charges = Math.max(0, charges - 1)
    prev = at
  }
  if (endless) charges = Math.min(CHARGE_CAP, charges + renewalsBetween(prev, tick))
  return charges
}

/** The Endless renewal line under the uses, e.g. "+1 use on 1 Dec (in 12 days 16 hours)." */
export function renewalNote(charges: number, tick: number): string {
  const next = nextRenewal(tick)
  const when = `${dateLabel(next)} (in ${formatDuration(next - tick)})`
  return charges >= CHARGE_CAP
    ? `Full: ${CHARGE_CAP} is the most you can hold. The next season starts ${when}; spend one before then to get it back.`
    : `+1 use on ${when}.`
}
