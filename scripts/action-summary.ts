/**
 * Summarise an action-assay report: paired comparisons per action, illness outbreak shape,
 * and the keeper policy. Pairs where either run hit a population safety ceiling are excluded.
 *
 *   node --import tsx scripts/action-summary.ts docs/experiments/actions-final.json [--markdown]
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Row } from './action-assay'

const LOSS = 1440

/** 95% Wilson score interval, as percentages rounded to whole numbers. */
export function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [0, 100]
  const z = 1.96, p = k / n, d = 1 + (z * z) / n
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d
  return [Math.round(100 * Math.max(0, c - h)), Math.round(100 * Math.min(1, c + h))]
}

const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Lost within 60 days of `hour`: the run ended by extinction before hour + 1440. */
const lostBy = (r: Row, hour: number) => !r.survived && r.endHour < hour + LOSS

export interface Paired {
  n: number
  improved: number
  spoiled: number
  survivedA: number
  survivedB: number
}

function pair(rows: [Row, Row][], outcome: (a: Row, b: Row) => [boolean, boolean]): Paired {
  const out: Paired = { n: rows.length, improved: 0, spoiled: 0, survivedA: 0, survivedB: 0 }
  for (const [a, b] of rows) {
    const [okA, okB] = outcome(a, b)
    if (okA) out.survivedA++
    if (okB) out.survivedB++
    if (okA && !okB) out.improved++
    if (!okA && okB) out.spoiled++
  }
  return out
}

export function summarise(rows: Row[]) {
  const by = new Map<string, Map<number, Row>>()
  for (const r of rows) {
    if (!by.has(r.condition)) by.set(r.condition, new Map())
    by.get(r.condition)!.set(r.seed, r)
  }
  const untouched = by.get('untouched')!
  const seeds = [...untouched.keys()].sort((a, b) => a - b)
  const u = [...untouched.values()]
  const uValid = u.filter(r => r.ceilingHits === 0)
  const base = {
    seeds: seeds.length,
    ceilingHitRuns: rows.filter(r => r.ceilingHits > 0).length,
    untouchedSurvived: uValid.filter(r => r.survived).length,
    untouchedValid: uValid.length,
    untouchedWilson: wilson(uValid.filter(r => r.survived).length, uValid.length),
    untouchedEnds: { rabbits: u.filter(r => r.extinct === 'rabbits').length, foxes: u.filter(r => r.extinct === 'foxes').length },
  }
  const conditions = [...by.keys()].filter(c => c !== 'untouched')
  const perCondition = conditions.map(cond => {
    const m = by.get(cond)!
    const arose = seeds.filter(s => m.get(s)?.arose)
    const excluded = arose.filter(s => m.get(s)!.ceilingHits > 0 || untouched.get(s)!.ceilingHits > 0)
    const valid = arose.filter(s => !excluded.includes(s))
    const pairs = valid.map(s => [m.get(s)!, untouched.get(s)!] as [Row, Row])
    const year = pair(pairs, (a, b) => [a.survived, b.survived])
    const sixty = pair(pairs, (a, b) => { const h = a.actions[0]?.hour ?? 0; return [!lostBy(a, h), !lostBy(b, h)] })
    const hourGain = pairs.map(([a, b]) => a.endHour - b.endHour)
    // Populations 30 days after the action vs the untouched run at the same day (nearest earlier midnight).
    const pop = pairs.filter(([a]) => a.after30 && a.actions.length === 1).map(([a, b]) => {
      const day = Math.floor((a.actions[0].hour - 1 + 720) / 24) - 1
      const ref = b.daily?.[day]
      return ref ? { dRabbits: a.after30!.rabbits - ref[0], dFoxes: a.after30!.foxes - ref[1] } : null
    }).filter(x => x !== null)
    const firstHours = arose.map(s => m.get(s)!.actions[0].hour)
    const uses: Record<string, number> = {}
    for (const s of valid) for (const a of m.get(s)!.actions) uses[a.action] = (uses[a.action] ?? 0) + 1
    return {
      condition: cond,
      arose: arose.length,
      excludedCeiling: excluded.length,
      valid: valid.length,
      medianFirstHour: median(firstHours),
      year,
      sixtyDays: sixty,
      meanHourGain: hourGain.length ? Math.round(hourGain.reduce((t, x) => t + x, 0) / hourGain.length) : null,
      medianRabbitChange30d: median(pop.map(p => p.dRabbits)),
      medianFoxChange30d: median(pop.map(p => p.dFoxes)),
      ...(cond === 'keeper' ? { uses } : {}),
    }
  })
  // Timely vs mistimed: seeds where both situations arose and neither run (nor untouched) hit a ceiling.
  const actions = [...new Set(conditions.filter(c => c.endsWith(':timely')).map(c => c.split(':')[0]))]
  const timelyVsMistimed = actions.map(action => {
    const t = by.get(`${action}:timely`)!, mi = by.get(`${action}:mistimed`)!
    const both = seeds.filter(s => t.get(s)?.arose && mi.get(s)?.arose && t.get(s)!.ceilingHits === 0 && mi.get(s)!.ceilingHits === 0)
    return { action, ...pair(both.map(s => [t.get(s)!, mi.get(s)!]), (a, b) => [a.survived, b.survived]) }
  })
  const illness = conditions.filter(c => c.startsWith('illness')).map(cond => {
    const rs = seeds.map(s => by.get(cond)!.get(s)!).filter(r => r.illness && r.ceilingHits === 0)
    const ill = rs.map(r => r.illness!)
    const overshoot = ill.filter(i => i.targetExtinct60).length
    return {
      condition: cond,
      n: rs.length,
      medianPeak: median(ill.map(i => i.peak)),
      medianHoursToPeak: median(ill.map(i => i.peakAfterHours)),
      medianCases: median(ill.map(i => i.cases)),
      medianIllnessDeaths60: median(ill.map(i => i.deaths60)),
      medianIll: Object.fromEntries((['d1', 'd3', 'd7', 'd14', 'd30'] as const).map(k => [k, median(ill.map(i => i.ill[k]).filter((x): x is number => x !== null))])),
      medianTargetAtIntro: median(rs.map(r => (cond.startsWith('illnessPrey') ? r.actions[0].signals.rabbits : r.actions[0].signals.foxes))),
      targetExtinct60: overshoot,
      targetExtinct60Wilson: wilson(overshoot, rs.length),
    }
  })
  const cull = seeds.map(s => by.get('cullPred:timely')?.get(s)).filter((r): r is Row => !!r && r.arose && r.ceilingHits === 0)
  const cullShape = {
    n: cull.length,
    medianFoxesAtAction: median(cull.map(r => r.actions[0].signals.foxes)),
    medianRemoved: median(cull.map(r => r.deaths.predCulled)),
    medianFoxes30d: median(cull.filter(r => r.after30).map(r => r.after30!.foxes)),
    foxesExtinct60: cull.filter(r => r.extinct === 'foxes' && r.endHour < r.actions[0].hour + LOSS).length,
  }
  return { base, perCondition, timelyVsMistimed, illness, cullShape }
}

export function markdown(s: ReturnType<typeof summarise>): string {
  const lines: string[] = []
  const b = s.base
  lines.push(`Untouched: ${b.untouchedSurvived}/${b.untouchedValid} survived (95% Wilson ${b.untouchedWilson[0]}–${b.untouchedWilson[1]}%); ` +
    `ended by rabbit extinction ${b.untouchedEnds.rabbits}, fox extinction ${b.untouchedEnds.foxes}. Runs with ceiling hits: ${b.ceilingHitRuns}.`, '')
  lines.push('| Condition | Arose | Excl. | Valid pairs | Year: survived (vs untouched) | Year improved / spoiled | 60 d improved / spoiled | Mean hours gained | Median Δ rabbits / foxes at 30 d |')
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
  for (const c of s.perCondition) {
    lines.push(`| ${c.condition} | ${c.arose} | ${c.excludedCeiling} | ${c.valid} | ${c.year.survivedA} (${c.year.survivedB}) | ${c.year.improved} / ${c.year.spoiled} | ` +
      `${c.sixtyDays.improved} / ${c.sixtyDays.spoiled} | ${c.meanHourGain ?? '—'} | ${c.medianRabbitChange30d ?? '—'} / ${c.medianFoxChange30d ?? '—'} |`)
  }
  lines.push('', '| Action | Seeds with both | Timely survived | Mistimed survived | Timely-only / mistimed-only |', '| --- | ---: | ---: | ---: | ---: |')
  for (const t of s.timelyVsMistimed) lines.push(`| ${t.action} | ${t.n} | ${t.survivedA} | ${t.survivedB} | ${t.improved} / ${t.spoiled} |`)
  lines.push('', '| Illness condition | Runs | Target at intro | Ill d1 / d3 / d7 / d14 / d30 | Peak | Hours to peak | Cases | Illness deaths (60 d) | Target extinct ≤60 d |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
  for (const i of s.illness) {
    const d = i.medianIll
    lines.push(`| ${i.condition} | ${i.n} | ${i.medianTargetAtIntro} | ${d.d1} / ${d.d3} / ${d.d7} / ${d.d14} / ${d.d30} | ${i.medianPeak} | ${i.medianHoursToPeak} | ${i.medianCases} | ${i.medianIllnessDeaths60} | ` +
      `${i.targetExtinct60}/${i.n} (${i.targetExtinct60Wilson[0]}–${i.targetExtinct60Wilson[1]}%) |`)
  }
  const c = s.cullShape
  lines.push('', `Cull (timely, ${c.n} runs): median ${c.medianFoxesAtAction} foxes at the decision, ${c.medianRemoved} removed, ${c.medianFoxes30d} foxes 30 days later; foxes extinct within 60 days in ${c.foxesExtinct60}.`)
  const k = s.perCondition.find(p => p.condition === 'keeper')
  if (k?.uses) lines.push('', `Keeper uses: ${Object.entries(k.uses).map(([a, n]) => `${a} ${n}`).join(', ')}.`)
  return lines.join('\n')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = JSON.parse(readFileSync(process.argv[2], 'utf8')) as { rows: Row[] }
  const s = summarise(report.rows)
  console.log(process.argv.includes('--markdown') ? markdown(s) : JSON.stringify(s, null, 2))
}
