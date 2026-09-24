/**
 * Why do foxes rarely breed? Counts fox births per run and, every tick, which breeding gate
 * blocks each fox (checked in the order giveBirth applies them: cap, age, gap, energy).
 *
 *   npx tsx scripts/fox-births.ts [firstSeed] [nSeeds]
 */
import { STABLE_PRESET } from '../src/game/presets'
import { deriveParams } from '../src/sim/levers'
import { SCENARIOS } from '../src/sim/scenarios'
import { Sim } from '../src/sim/sim'

const from = Number(process.argv[2] ?? 0)
const n = Number(process.argv[3] ?? 5)
const p = deriveParams(STABLE_PRESET, 'energy')
const dp = p.pred

for (const sc of SCENARIOS) {
  const gate = { cap: 0, age: 0, gap: 0, energy: 0, ready: 0 }
  let births = 0
  let ticks = 0
  let survived = 0
  let atCapTicks = 0
  let firstBirthAges: number[] = []
  const lifetimes: number[] = []
  for (let seed = from; seed < from + n; seed++) {
    const sim = new Sim(p, seed, sc.disturbance)
    const firstBirth = new Map<number, number>()
    const bornAt = new Map<number, number>()
    for (const a of sim.preds) bornAt.set(a.id, 0)
    let prevIds = new Set(sim.preds.map((a) => a.id))
    while (sim.step()) {
      const cap = sim.cap('pred')
      if (sim.preds.length >= cap) atCapTicks++
      for (const a of sim.preds) {
        if (!bornAt.has(a.id)) bornAt.set(a.id, sim.tick)
        if (a.lastBirth >= 0 && !firstBirth.has(a.id)) firstBirth.set(a.id, a.lastBirth)
        const since = a.lastBirth < 0 ? dp.birthGap : a.age - a.lastBirth
        if (sim.preds.length >= cap) gate.cap++
        else if (a.age < dp.adultAge) gate.age++
        else if (since < dp.birthGap) gate.gap++
        else if (a.energy < dp.breedEnergy * dp.maxEnergy || a.energy <= dp.childEnergy * dp.maxEnergy) gate.energy++
        else gate.ready++
      }
      const ids = new Set(sim.preds.map((a) => a.id))
      for (const id of prevIds) if (!ids.has(id) && bornAt.get(id)! > 0) lifetimes.push(sim.tick - bornAt.get(id)!)
      prevIds = ids
    }
    births += sim.counters.predBorn
    ticks += sim.tick
    if (sim.survived) survived++
    firstBirthAges = firstBirthAges.concat([...firstBirth.values()])
  }
  const total = gate.cap + gate.age + gate.gap + gate.energy + gate.ready
  const pct = (x: number) => `${((100 * x) / total).toFixed(1)}%`
  const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[xs.length >> 1] : NaN)
  console.log(
    `${sc.id.padEnd(9)} survived ${survived}/${n}  fox births ${births} (${((births / ticks) * 24 * 30).toFixed(1)} per 30 days)` +
      `  fox-hours at cap ${((100 * atCapTicks) / ticks).toFixed(0)}% of ticks` +
      `  blocked by cap ${pct(gate.cap)} age ${pct(gate.age)} gap ${pct(gate.gap)} energy ${pct(gate.energy)} ready ${pct(gate.ready)}` +
      `  median first-birth age ${med(firstBirthAges)} h  median kit lifetime ${med(lifetimes)} h (lifespan ${dp.lifespan} h)`,
  )
}
