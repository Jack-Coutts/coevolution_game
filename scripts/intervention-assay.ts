import { writeFileSync } from 'node:fs'
import { STABLE_PRESET } from '../src/game/presets'
import { deriveParams } from '../src/sim/levers'
import { Sim, type Intervention } from '../src/sim/sim'
const rows: {seed:number;strategy:string;survived:boolean;tick:number;actions:{tick:number;action:Intervention}[];ceilingHits:number}[]=[]
const start=Number(process.argv[2] ?? 3000), count=Number(process.argv[3] ?? 50)
for(let seed=start;seed<start+count;seed++){
 for(const strategy of ['untouched','watchful'] as const){
  const s=new Sim(deriveParams(STABLE_PRESET),seed)
  const actions:{tick:number;action:Intervention}[]=[]
  let cooldown=0
  while(!s.ended){
   if(strategy==='watchful' && s.tick>=cooldown && actions.length<4){
    let action:Intervention|null=null
    const foxEnergy=s.preds.reduce((sum,a)=>sum+a.energy/s.p.pred.maxEnergy,0)/s.preds.length
    const rabbitEnergy=s.prey.reduce((sum,a)=>sum+a.energy/s.p.prey.maxEnergy,0)/s.prey.length
    if(s.tick>240 && s.prey.length<60 && s.preds.length>12)action='cullPred'
    else if(s.tick>240 && s.preds.length<=3 && foxEnergy<0.5)action='feedFoxes'
    else if(s.tick>240 && rabbitEnergy<0.35)action='rain'
    else if(s.tick>240 && s.prey.length<30)action='releasePrey'
    if(action){s.queue(action);actions.push({tick:s.tick+1,action});cooldown=s.tick+400}
   }
   s.step()
  }
  rows.push({seed,strategy,survived:s.survived,tick:s.tick,actions,ceilingHits:s.ceilingHits})
 }
 console.log(seed)
}
const summary=['untouched','watchful'].map(strategy=>({strategy,survived:rows.filter(r=>r.strategy===strategy&&r.survived).length,count,meanHours:rows.filter(r=>r.strategy===strategy).reduce((n,r)=>n+r.tick,0)/count}))
console.table(summary)
writeFileSync(process.argv[4]??'/tmp/meadow-interventions.json',JSON.stringify({start,count,parameters:deriveParams(STABLE_PRESET),note:'Illustrative fixed threshold strategy, not optimal human play; same starting seeds and four charges with 400-hour cooldown.',summary,rows},null,2))
