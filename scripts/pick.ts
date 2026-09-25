/**
 * Rank sweep candidates: stable-meadow survival on held-out seeds, how hard each scenario
 * knocks it, and distance from the default levers.
 *
 *   npx tsx scripts/pick.ts <candidates.json> [seedsFrom] [nSeeds]
 */
import { readFileSync } from 'node:fs'
import { defaultLevers, deriveParams, LEVER_BY_ID, type LeverValues } from '../src/sim/levers'
import { SCENARIOS } from '../src/sim/scenarios'
import { runHeadless } from '../src/sim/sim'

const cands = JSON.parse(readFileSync(process.argv[2], 'utf8')) as LeverValues[]
const from = Number(process.argv[3] ?? 100)
const n = Number(process.argv[4] ?? 20)
const bench = defaultLevers()

function distance(v: LeverValues): number {
  let d = 0
  for (const id of Object.keys(v)) {
    const def = LEVER_BY_ID[id]
    if (!def) continue
    d += Math.abs(v[id] - bench[id]) / (def.max - def.min)
  }
  return d
}

cands.forEach((v, i) => {
  const p = deriveParams(v)
  const row: string[] = [`#${i}`, `dist=${distance(v).toFixed(2)}`]
  for (const sc of SCENARIOS.filter(s => s.species.length === 2)) {
    let ok = 0
    const ticks: number[] = []
    for (let s = from; s < from + n; s++) {
      const r = runHeadless(p, s, sc.disturbance)
      if (r.survived) ok++
      ticks.push(r.survival_ticks)
    }
    ticks.sort((a, b) => a - b)
    row.push(`${sc.id}=${ok}/${n}(med ${ticks[n >> 1]})`)
  }
  console.log(row.join('  '))
})
