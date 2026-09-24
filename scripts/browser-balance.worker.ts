/// <reference lib="webworker" />
import { Sim } from '@/sim/sim'
import { deriveParams } from '@/sim/levers'
import { STABLE_PRESET } from '@/game/presets'
self.onmessage = (event: MessageEvent<{start:number;count:number}>) => {
  const {start,count} = event.data
  const rows = []
  const parameters = deriveParams(STABLE_PRESET)
  for(let seed=start;seed<start+count;seed++) {
    const sim = new Sim(parameters,seed)
    while(sim.step()) { /* fixed tick simulation */ }
    rows.push({seed,survived:sim.survived,tick:sim.tick,prey:sim.prey.length,foxes:sim.preds.length,safetyLimitHits:sim.ceilingHits})
    self.postMessage({progress:rows.length})
  }
  self.postMessage({result:{parameters,survived:rows.filter(r=>r.survived).length,start,count,rows}})
}
