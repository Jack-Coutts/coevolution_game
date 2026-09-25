/**
 * Summarise a scenario-assay report per scenario: survival by condition, paired changes against
 * the untouched run, when and why runs collapsed, and whether the warning reached a living meadow.
 * Seeds where any condition hit a population safety ceiling are excluded from every count.
 *
 *   node --import tsx scripts/scenario-summary.ts docs/experiments/scenarios-final.json
 */
import { readFileSync } from 'node:fs'
import { wilson } from './action-summary'
import type { Condition, Row } from './scenario-assay'

const report = JSON.parse(readFileSync(process.argv[2], 'utf8')) as { rows: Row[]; scenarios: { id: string; onset: number; decision: string }[] }
const count = (xs: string[]) => {
  const m = new Map<string, number>()
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ') || '-'
}

for (const sc of report.scenarios) {
  const rows = report.rows.filter(r => r.scenario === sc.id)
  const conds = [...new Set(rows.map(r => r.condition))] as Condition[]
  const seeds = [...new Set(rows.map(r => r.seed))].sort((a, b) => a - b)
  const ceiling = seeds.filter(s => rows.some(r => r.seed === s && r.ceilingHits > 0))
  const valid = seeds.filter(s => !ceiling.includes(s))
  const get = (c: Condition, s: number) => rows.find(r => r.condition === c && r.seed === s)!
  console.log(`\n## ${sc.id} (onset hour ${sc.onset}; ${valid.length} valid seeds${ceiling.length ? `, excluded for ceiling hits: ${ceiling.join(', ')}` : ''})`)
  console.log(`decision: ${sc.decision}`)
  for (const c of conds) {
    const rs = valid.map(s => get(c, s))
    const k = rs.filter(r => r.survived).length
    const [lo, hi] = wilson(k, rs.length)
    let paired = ''
    if (c !== 'untouched') {
      const rescued = valid.filter(s => get(c, s).survived && !get('untouched', s).survived).length
      const spoiled = valid.filter(s => !get(c, s).survived && get('untouched', s).survived).length
      paired = `; vs untouched: +${rescued} rescued, -${spoiled} lost`
    }
    const reached = rs.filter(r => r.phase !== 'before').length
    const noticed = rs.filter(r => r.noticeHour !== null).length
    console.log(`- ${c}: ${k}/${rs.length} survived (95% CI ${lo}-${hi}%)${paired}; alive at warning ${noticed}, at onset ${reached}`)
    console.log(`    ended: ${count(rs.map(r => r.phase))}`)
    console.log(`    causes: ${count(rs.filter(r => !r.survived).map(r => r.cause))}`)
    if (c !== 'untouched') console.log(`    actions: ${count(rs.flatMap(r => r.actions.map(a => `${a.action}${a.hour >= sc.onset - 336 ? '(after warning)' : ''}`)))}`)
  }
  const u = valid.map(s => get('untouched', s))
  const leads = u.filter(r => r.noticeHour !== null).map(r => (sc.onset - r.noticeHour!) / 24)
  console.log(`- untouched warning lead (days): ${[...new Set(leads)].join(', ') || 'none'}; collapses during/after the disturbance with a warning note in the last 10 days: ` +
    `${u.filter(r => !r.survived && r.phase !== 'before' && r.notesBeforeEnd.some(n => n !== 'steady' && n !== 'replace')).length}/${u.filter(r => !r.survived && r.phase !== 'before').length}`)
  const onset = u.filter(r => r.atOnset).map(r => r.atOnset!)
  if (onset.length) console.log(`- untouched state at onset (median): rabbits ${med(onset.map(o => o.rabbits))}, foxes ${med(onset.map(o => o.foxes))}, bushes ${med(onset.map(o => o.bushes))}, stock ${med(onset.map(o => o.stock))}`)
}

function med(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
