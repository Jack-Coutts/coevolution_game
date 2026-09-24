/**
 * Natural-time labels. The simulation runs in ticks; the UI shows 1 tick = 1 hour,
 * starting 1 September 06:00 (non-leap year). Durations count a month as 30 days.
 */
export const START_HOUR = 6
export const HOURS_PER_DAY = 24
export const DAYS_PER_MONTH = 30

const MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']
const MONTH_LONG = [
  'September',
  'October',
  'November',
  'December',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
]
const MONTH_DAYS = [30, 31, 30, 31, 31, 28, 31, 30, 31, 30, 31, 31]

export type Season = 'autumn' | 'winter' | 'spring' | 'summer'

export interface CalendarTime {
  dayOfRun: number
  month: number
  monthName: string
  monthLong: string
  day: number
  hour: number
  season: Season
}

export function calendar(tick: number): CalendarTime {
  const hours = tick + START_HOUR
  let dayIdx = Math.floor(hours / HOURS_PER_DAY)
  const hour = hours - dayIdx * HOURS_PER_DAY
  const dayOfRun = Math.floor(tick / HOURS_PER_DAY) + 1
  let month = 0
  while (dayIdx >= MONTH_DAYS[month % 12]) {
    dayIdx -= MONTH_DAYS[month % 12]
    month++
  }
  const m = month % 12
  return {
    dayOfRun,
    month: m,
    monthName: MONTHS[m],
    monthLong: MONTH_LONG[m],
    day: dayIdx + 1,
    hour,
    season: seasonOf(m),
  }
}

function seasonOf(m: number): Season {
  if (m <= 2) return 'autumn'
  if (m <= 5) return 'winter'
  if (m <= 8) return 'spring'
  return 'summer'
}

/** Tick at 00:00 on the given day of a month, counting months from September (0). */
export function tickAt(monthFromSep: number, day = 1, hour = 0): number {
  let days = 0
  for (let m = 0; m < monthFromSep; m++) days += MONTH_DAYS[m % 12]
  days += day - 1
  return days * HOURS_PER_DAY + hour - START_HOUR
}

/** Start ticks of each calendar month within [0, horizon]. */
export function monthStarts(horizon: number): { tick: number; label: string }[] {
  const out: { tick: number; label: string }[] = []
  for (let m = 1; m < 13; m++) {
    const t = tickAt(m)
    if (t > horizon) break
    out.push({ tick: t, label: MONTHS[m % 12] })
  }
  return out
}

export function dateLabel(tick: number): string {
  const c = calendar(tick)
  return `${c.day} ${c.monthName}`
}

export function clockLabel(tick: number): string {
  const c = calendar(tick)
  return `${String(c.hour).padStart(2, '0')}:00`
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** "11 months 3 days", "5 days 4 hours", "7 hours". */
export function formatDuration(ticks: number): string {
  const t = Math.max(0, Math.round(ticks))
  const days = Math.floor(t / HOURS_PER_DAY)
  const hours = t % HOURS_PER_DAY
  const months = Math.floor(days / DAYS_PER_MONTH)
  const d = days % DAYS_PER_MONTH
  if (months > 0) return d > 0 ? `${plural(months, 'month')} ${plural(d, 'day')}` : plural(months, 'month')
  if (days > 0) return hours > 0 ? `${plural(days, 'day')} ${plural(hours, 'hour')}` : plural(days, 'day')
  return plural(hours, 'hour')
}

/** Compact lever-style duration: "15 h", "6 d 6 h", "25 d". */
export function formatHours(ticks: number): string {
  const t = Math.round(ticks)
  if (t < 48) return `${t} h`
  const d = Math.floor(t / HOURS_PER_DAY)
  const h = t % HOURS_PER_DAY
  return h === 0 ? `${d} d` : `${d} d ${h} h`
}

/** Light level 0 (midnight) .. 1 (noon). */
export function daylight(tick: number): number {
  const hour = (((tick + START_HOUR) % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY
  const x = Math.cos(((hour - 13) / 24) * 2 * Math.PI)
  return Math.min(1, Math.max(0, 0.5 + 0.75 * x))
}
