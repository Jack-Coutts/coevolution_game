import { benchmarkLevers, deriveParams } from '../src/sim/levers'
import { runHeadless } from '../src/sim/sim'
const v = benchmarkLevers()
for (const rules of ['classic', 'energy'] as const) {
  const p = deriveParams(v, rules)
  const t0 = performance.now()
  const r = Array.from({ length: 10 }, (_, s) => runHeadless(p, s))
  console.log(rules, r.map((x) => `${x.survival_ticks}/${x.prey_end}/${x.predator_end}`).join(' '), (performance.now() - t0).toFixed(0) + 'ms')
}
