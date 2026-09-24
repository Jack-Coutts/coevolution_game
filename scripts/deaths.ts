/**
 * Fox deaths by cause, plus whether the year was reached.
 *   npx tsx scripts/deaths.ts [seed...]
 */
import { STABLE_PRESET } from '../src/game/presets'
import { deriveParams } from '../src/sim/levers'
import { Sim } from '../src/sim/sim'

const list = process.argv.slice(2).map(Number)
const seeds = list.length ? list : Array.from({ length: 10 }, (_, i) => 100 + i)
const p = deriveParams(STABLE_PRESET)
let year = 0
let starved = 0
let old = 0
for (const seed of seeds) {
  const s = new Sim(p, seed)
  let maxPrey = 0
  let maxFox = 0
  const t0 = Date.now()
  while (s.step()) {
    if (s.tick % 48 === 0) {
      maxPrey = Math.max(maxPrey, s.prey.length)
      maxFox = Math.max(maxFox, s.preds.length)
    }
  }
  maxPrey = Math.max(maxPrey, s.prey.length)
  maxFox = Math.max(maxFox, s.preds.length)
  if (s.survived) year++
  const c = s.counters
  starved += c.predStarved
  old += c.predOld
  const fox = c.predStarved + c.predOld
  console.log(
    `seed ${seed} ${s.survived ? 'YEAR' : 'dead'} t=${s.tick} prey=${s.prey.length} fox=${s.preds.length} maxPrey=${maxPrey} maxFox=${maxFox} starve=${c.predStarved} old=${c.predOld} starveShare=${fox ? (c.predStarved / fox).toFixed(2) : '-'} eaten=${c.preyEaten} preyStarve=${c.preyStarved} ${Date.now() - t0}ms`,
  )
}
const fox = starved + old
console.log(`years ${year}/${seeds.length}  fox starve ${starved} old ${old} share ${fox ? (starved / fox).toFixed(2) : '-'}`)
