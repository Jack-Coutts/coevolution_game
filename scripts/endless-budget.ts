// Endless intervention budget comparison (issue #5): a greedy threshold keeper under four budget rules.
// Usage: npx tsx scripts/endless-budget.ts <seeds> <years> <scenario> <first seed>. Prints one JSON row per run.
import { STABLE_PRESET } from '../src/game/presets'
import { deriveParams } from '../src/sim/levers'
import { Sim, type Intervention } from '../src/sim/sim'
import { SCENARIO_BY_ID } from '../src/sim/scenarios'
import { chargesAt, COOLDOWN } from '../src/game/budget'

type Rule = (spent: number[], t: number) => number
const periodic = (every: number, cap: number): Rule => (spent, t) => {
  let c = 4, prev = 0
  for (const at of spent) { c = Math.min(cap, c + Math.floor(at / every) - Math.floor(prev / every)) - 1; prev = at }
  return Math.min(cap, c + Math.floor(t / every) - Math.floor(prev / every))
}
const RULES: Record<string, Rule> = {
  lifetime: (s) => 4 - s.length,
  seasonal: (s, t) => chargesAt(s, t, true),
  monthly: periodic(720, 4),
  yearlyRefill: (s, t) => 4 - s.filter(x => Math.floor((x + 8) / 8760) === Math.floor((t + 8) / 8760)).length,
}
const seeds = Number(process.argv[2] ?? 5), years = Number(process.argv[3] ?? 3), scen = (process.argv[4] ?? 'winter') as 'winter'
const H = years * 8760
const out: Record<string, unknown>[] = []
const s0 = Number(process.argv[5] ?? 7300)
for (let seed = s0; seed < s0 + seeds; seed++) for (const [name, rule] of Object.entries(RULES)) {
  const p = deriveParams(STABLE_PRESET); p.endless = true
  const s = new Sim(p, seed, SCENARIO_BY_ID[scen].disturbance)
  const spent: number[] = []; let cool = 0, deniedHours = 0
  const t0 = Date.now()
  while (!s.ended && s.tick < H) {
    let action: Intervention | null = null
    if (s.tick > 240 && s.prey.length > 0 && s.preds.length > 0) {
      const fe = s.preds.reduce((n, a) => n + a.energy / s.p.pred.maxEnergy, 0) / s.preds.length
      const re = s.prey.reduce((n, a) => n + a.energy / s.p.prey.maxEnergy, 0) / s.prey.length
      if (s.prey.length < 60 && s.preds.length > 12) action = 'cullPred'
      else if (s.preds.length <= 3 && fe < 0.5) action = 'feedFoxes'
      else if (re < 0.35) action = 'rain'
      else if (s.prey.length < 30) action = 'releasePrey'
    }
    if (action && s.tick >= cool) {
      if (rule(spent, s.tick) > 0) { s.queue(action); spent.push(s.tick); cool = s.tick + COOLDOWN }
      else deniedHours++
    }
    s.step()
  }
  const perYear = Array.from({ length: years }, (_, y) => spent.filter(t => Math.floor((t + 8) / 8760) === y).length)
  const winter = spent.filter(t => { const h = (t + 8) % 8760; return h >= 2184 && h < 4344 }).length
  const r = { seed, rule: name, days: Math.round(s.tick / 24), survived: s.tick >= H, usesPerYear: perYear.join('/'), winterUses: winter, deniedDays: Math.round(deniedHours / 24), secs: Math.round((Date.now() - t0) / 1000) }
  out.push(r); console.log(JSON.stringify(r))
}
const summary = Object.keys(RULES).map(rule => {
  const rs = out.filter(r => r.rule === rule) as { days: number; survived: boolean; usesPerYear: string; winterUses: number; deniedDays: number }[]
  const per = Array.from({ length: years }, (_, y) => (rs.reduce((n, r) => n + Number(r.usesPerYear.split('/')[y]), 0) / rs.length).toFixed(1)).join('/')
  return { rule, survivedAll: `${rs.filter(r => r.survived).length}/${rs.length}`, meanDays: Math.round(rs.reduce((n, r) => n + r.days, 0) / rs.length), meanUsesPerYear: per, meanWinterUses: (rs.reduce((n, r) => n + r.winterUses, 0) / rs.length).toFixed(1), meanDeniedDays: Math.round(rs.reduce((n, r) => n + r.deniedDays, 0) / rs.length) }
})
console.log(JSON.stringify(summary, null, 1))
