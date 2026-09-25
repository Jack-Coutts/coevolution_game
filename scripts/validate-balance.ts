import { writeFileSync } from 'node:fs'
import { STABLE_PRESET } from '../src/game/presets'
import { deriveParams, spent } from '../src/sim/levers'
import { Sim } from '../src/sim/sim'
const start = Number(process.argv[2] ?? 1000), count = Number(process.argv[3] ?? 50)
const rows = []
const p = deriveParams(STABLE_PRESET)
// BODY=off runs the meadow without inherited body size (issue #10), exactly as before it existed.
if (process.env.BODY === 'off') delete p.eco.body
for (let seed = start; seed < start + count; seed++) {
  const s = new Sim(p, seed)
  let maxPrey = s.prey.length, maxFox = s.preds.length
  while (s.step()) {maxPrey = Math.max(maxPrey, s.prey.length); maxFox = Math.max(maxFox, s.preds.length)}
  rows.push({ seed, survived: s.survived, tick: s.tick, prey: s.prey.length, foxes: s.preds.length, maxPrey, maxFox, safetyLimitHits: s.ceilingHits, deaths: s.counters })
  console.log(seed, s.survived, s.tick, s.prey.length, s.preds.length)
}
const survived = rows.filter(r => r.survived).length
const result = { start, count, survived, survivalRate: survived/count, parameters: p, rows }
writeFileSync(process.argv[4] ?? '/tmp/meadow-validation.json', JSON.stringify(result, null, 2))
console.log({survived, count, unspent: 30 - spent(STABLE_PRESET, STABLE_PRESET)})
