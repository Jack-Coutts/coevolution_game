import { useState, type Ref } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGame } from '@/hooks/use-game'
import type { Species } from '@/sim/sim'
import { formatHours } from '@/sim/time'
import { ANIMAL_STRIDE } from '@/worker/protocol'
import { displayOrder, framePop, SPECIES_UI } from '@/game/species-ui'

export interface AnimalSelection { species: Species; id: number }

const cls = 'rounded-md border bg-background px-2 py-1.5 text-sm'

/** Details of the selected animal; with `picker`, also lets the player choose one from the displayed frame. */
export function AnimalInspector({ selected, onSelect, picker = false, ref }: { selected: AnimalSelection | null; onSelect: (a: AnimalSelection | null) => void; picker?: boolean; ref?: Ref<HTMLElement> }) {
  const [game, snap] = useGame()
  const [species, setSpecies] = useState<Species>(selected?.species ?? 'prey')
  const frame = game.history.frameAt(snap.tick)?.a
  const options: number[] = []
  const animals = picker && frame ? framePop(frame, species) : undefined
  if (animals) for (let i = 0; i < animals.length; i += ANIMAL_STRIDE) options.push(animals[i])
  const inspected = selected && frame ? framePop(frame, selected.species) : null
  let animal: Float32Array | null = null
  if (inspected && selected) for (let i = 0; i < inspected.length; i += ANIMAL_STRIDE)
    if (inspected[i] === selected.id) animal = inspected.subarray(i, i + ANIMAL_STRIDE)
  const name = selected && `${SPECIES_UI[selected.species].name} #${selected.id}`
  return <section ref={ref} className="@container rounded-lg border bg-card p-3" aria-label={picker ? 'Animal inspector' : 'Selected animal'}>
    {picker ? <>
      <h3 className="text-sm font-semibold">Animal inspector</h3>
      <p className="mt-1 text-xs text-muted-foreground">Click an animal in the meadow, or choose one below. The meadow pauses for inspection.</p>
      <div className="mt-2 flex gap-2">
        <select className={cls} aria-label="Inspector species" value={species} onChange={e => setSpecies(e.target.value as Species)}>
          {displayOrder(game.scenario.species).map(s => <option key={s} value={s}>{SPECIES_UI[s].Plural}</option>)}
        </select>
        <select className={cls + ' min-w-0 flex-1'} aria-label="Inspect an animal" value={selected?.species === species && options.includes(selected.id) ? selected.id : ''}
          onChange={e => { if (e.target.value) { game.pause(); onSelect({ species, id: Number(e.target.value) }) } else onSelect(null) }}>
          <option value="">Choose {SPECIES_UI[species].one}…</option>
          {options.map(id => <option key={id} value={id}>{SPECIES_UI[species].name} #{id}</option>)}
        </select>
      </div>
    </> : <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold"><span className={selected ? SPECIES_UI[selected.species].text : undefined}>{name}</span></h3>
      <Button variant="ghost" size="icon-xs" aria-label="Close inspector" onClick={() => onSelect(null)}><X /></Button>
    </div>}
    {selected && <div className={picker ? 'mt-3 text-sm' : 'mt-1 text-sm'}>
      {picker && <strong>{name}</strong>}
      {animal ? <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs @xs:grid-cols-3 @xl:grid-cols-4">
        {facts(animal, selected.species).map(([k, v, tip]) => <div key={k} title={tip}><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}
      </dl> : <p className="mt-2 text-xs text-muted-foreground">This animal is no longer present at the displayed time. Scrub back to inspect its earlier life.</p>}
    </div>}
  </section>
}

/** The inspector's rows: label, value and an optional explanation shown on hover. */
function facts(animal: Float32Array, species: Species): [string, string | number, string?][] {
  const rows: [string, string | number, string?][] = [
    ['Generation', animal[9]],
    ['Age', formatHours(animal[10])],
    ['Energy', `${Math.round(animal[5] * 100)}%`, 'Fuel left in the tank. At 0% the animal starves.'],
    ['Illness', animal[21] > 0 ? `Ill for up to ${formatHours(animal[21])} more` : 'None', 'Illness adds an energy drain; it is separate from hunger.'],
    ['Offspring', animal[13]],
    ['Parent', animal[11] < 0 ? 'Founder / arrival' : `#${animal[11]}`],
    ['Lineage', `#${animal[12]}`, 'The founder this family descends from (its id), not a count.'],
    ['Sight range', `${Math.round(animal[14] * 100)}% of meadow`, 'How far it sees, as a share of the meadow width. Over 100% means it can see across the whole meadow.'],
  ]
  // Brains start with no extra neurons; mutation can add them. Only worth a row once there are some.
  if (animal[16] > 0) rows.push(['Extra neurons', animal[16], 'Hidden neurons gained by mutation. More of them allow more complex responses.'])
  rows.push(
    ['Food seeking', animal[17].toFixed(2), `Inherited: -1 to 1, higher means it steers to food more strongly.${species === 'vole' ? ' For a vole, food is grass seed first, then berries.' : ''}`],
    ['Threat avoidance', animal[18].toFixed(2), species !== 'pred'
      ? 'Inherited: -1 to 1, higher means it turns away from a nearby fox more strongly.'
      : 'Inherited, -1 to 1. Nothing hunts foxes here, so this tendency is never used and drifts freely.'],
    ['Cruising pace', animal[19].toFixed(2), 'Inherited: 0 = resting to 1 = maximum pace.'],
    ['Cover seeking', animal[20].toFixed(2), 'Inherited: -1 to 1, higher means it heads for tall grass when a threat is in view.'],
  )
  return rows
}
