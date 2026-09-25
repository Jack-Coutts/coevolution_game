import { useMemo, useState, type Ref } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGame } from '@/hooks/use-game'
import type { Species } from '@/sim/sim'
import { clockLabel, dateLabel, formatHours } from '@/sim/time'
import { ANIMAL_SIZE, ANIMAL_STRIDE } from '@/worker/protocol'
import { displayOrder, framePop, SPECIES_UI } from '@/game/species-ui'

export interface AnimalSelection { species: Species; id: number }

const cls = 'rounded-md border bg-background px-2 py-1.5 text-sm'
const link = 'font-medium text-primary underline-offset-2 hover:underline'
type Order = 'generation' | 'family' | 'id'
const dayOf = (tick: number) => Math.floor(tick / 24) + 1
const when = (tick: number) => `day ${dayOf(tick)} (${dateLabel(tick)}, ${clockLabel(tick)})`

/** Details of the selected animal; with `picker`, also lets the player choose one from the displayed frame. */
export function AnimalInspector({ selected, onSelect, onFamily, picker = false, ref }: {
  selected: AnimalSelection | null
  onSelect: (a: AnimalSelection | null) => void
  /** Show a founder family's history (the Evolution page). */
  onFamily?: (f: AnimalSelection) => void
  picker?: boolean
  ref?: Ref<HTMLElement>
}) {
  const [game, snap] = useGame()
  const [species, setSpecies] = useState<Species>(selected?.species ?? 'prey')
  const [order, setOrder] = useState<Order>('generation')
  const frame = game.history.frameAt(snap.tick)?.a
  const rowsOf = (s: Species) => (frame ? framePop(frame, s) : undefined)
  const options: { id: number; gen: number; family: number }[] = []
  const animals = picker ? rowsOf(species) : undefined
  if (animals) for (let i = 0; i < animals.length; i += ANIMAL_STRIDE) options.push({ id: animals[i], gen: animals[i + 9], family: animals[i + 12] })
  options.sort(order === 'generation' ? (a, b) => b.gen - a.gen || a.id - b.id : order === 'family' ? (a, b) => a.family - b.family || b.gen - a.gen || a.id - b.id : (a, b) => a.id - b.id)
  const rows = selected ? rowsOf(selected.species) : undefined
  let animal: Float32Array | null = null
  if (rows && selected) for (let i = 0; i < rows.length; i += ANIMAL_STRIDE) if (rows[i] === selected.id) animal = rows.subarray(i, i + ANIMAL_STRIDE)
  const name = selected && `${one(selected.species)} #${selected.id}`
  const choose = (a: AnimalSelection, at?: number) => { game.pause(); if (at !== undefined) game.seek(at); setSpecies(a.species); onSelect(a) }
  return <section ref={ref} className="@container rounded-lg border bg-card p-3" aria-label={picker ? 'Animal inspector' : 'Selected animal'}>
    {picker ? <>
      <h3 className="text-sm font-semibold">Animal inspector</h3>
      <p className="mt-1 text-xs text-muted-foreground">Click an animal in the meadow, or choose one below. The meadow pauses for inspection.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <select className={cls} aria-label="Inspector species" value={species} onChange={e => setSpecies(e.target.value as Species)}>
          {displayOrder(game.scenario.species).map(s => <option key={s} value={s}>{SPECIES_UI[s].Plural}</option>)}
        </select>
        <select className={cls} aria-label="Order animals by" value={order} onChange={e => setOrder(e.target.value as Order)}>
          <option value="generation">Newest generation first</option><option value="family">By family</option><option value="id">By id</option>
        </select>
        <select className={cls + ' min-w-0 flex-1'} aria-label="Inspect an animal" value={selected?.species === species && options.some(o => o.id === selected.id) ? selected.id : ''}
          onChange={e => { if (e.target.value) choose({ species, id: Number(e.target.value) }); else onSelect(null) }}>
          <option value="">Choose {SPECIES_UI[species].one} ({options.length} alive)…</option>
          {options.map(o => <option key={o.id} value={o.id}>{one(species)} #{o.id} · gen {o.gen} · family #{o.family}</option>)}
        </select>
      </div>
    </> : <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold"><span className={selected ? SPECIES_UI[selected.species].text : undefined}>{name}</span></h3>
      <Button variant="ghost" size="icon-xs" aria-label="Close inspector" onClick={() => onSelect(null)}><X /></Button>
    </div>}
    {selected && <div className={picker ? 'mt-3 text-sm' : 'mt-1 text-sm'}>
      {picker && <strong>{name}</strong>}
      {animal ? <>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs @xs:grid-cols-3 @xl:grid-cols-4">
          {facts(animal, selected.species).map(([k, v, tip]) => <div key={k} title={tip}><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}
        </dl>
        <Family animal={animal} selected={selected} tick={snap.tick} rows={rows} choose={choose} onFamily={onFamily} />
      </> : <Absent selected={selected} tick={snap.tick} onShow={at => choose(selected, at)} />}
    </div>}
  </section>
}

const one = (s: Species) => SPECIES_UI[s].name

/** The selected animal is not alive at the displayed hour: say when it was last seen, or that the kept replay does not show it. */
function Absent({ selected, tick, onShow }: { selected: AnimalSelection; tick: number; onShow: (at: number) => void }) {
  const [game] = useGame()
  const history = game.history
  const seen = useMemo(() => history.lastSeen(selected.species, selected.id, tick), [history, selected.species, selected.id, tick])
  if (!seen) return <p className="mt-2 text-xs text-muted-foreground">Not alive at the displayed time, and not in the kept replay (from day {dayOf(history.replayStart)}). It died before then, or was born later.</p>
  return <p className="mt-2 text-xs text-muted-foreground">
    Died: last seen on {when(seen.tick)}, generation {seen.row[9]}, age {formatHours(seen.row[10])}.{' '}
    <button type="button" className={link} onClick={() => onShow(seen.tick)}>Show it on day {dayOf(seen.tick)}</button>
  </p>
}

/** Parent, family and living offspring at the displayed hour, with links to follow them. */
function Family({ animal, selected, tick, rows, choose, onFamily }: {
  animal: Float32Array; selected: AnimalSelection; tick: number; rows: Float32Array | undefined
  choose: (a: AnimalSelection, at?: number) => void; onFamily?: (f: AnimalSelection) => void
}) {
  const [game] = useGame()
  const history = game.history
  const s = selected.species
  const parent = animal[11]
  const family = animal[12]
  const offspring: number[] = []
  let relatives = 0
  let parentAlive = false
  if (rows) for (let i = 0; i < rows.length; i += ANIMAL_STRIDE) {
    if (rows[i + 11] === selected.id) offspring.push(rows[i])
    if (rows[i + 12] === family) relatives++
    if (rows[i] === parent) parentAlive = true
  }
  const seen = useMemo(() => (parent >= 0 && !parentAlive ? history.lastSeen(s, parent, tick) : null), [history, s, parent, parentAlive, tick])
  return <div className="mt-3 space-y-1 border-t pt-2 text-xs" aria-label="Family">
    <p><span className="text-muted-foreground">Parent: </span>{parent < 0 ? 'none (a founder or arrival)'
      : parentAlive ? <><button type="button" className={link} onClick={() => choose({ species: s, id: parent })}>{one(s)} #{parent}</button> (alive)</>
      : seen ? <>{one(s)} #{parent}, died (last seen day {dayOf(seen.tick)}, generation {seen.row[9]}). <button type="button" className={link} onClick={() => choose({ species: s, id: parent }, seen.tick)}>Show it then</button></>
      : <>{one(s)} #{parent}, died before the kept replay (from day {dayOf(history.replayStart)}).</>}</p>
    <p title="The founder this family descends from (its id), and how many of its members are alive at the displayed time.">
      <span className="text-muted-foreground">Family: </span>
      {onFamily ? <button type="button" className={link} onClick={() => onFamily({ species: s, id: family })}>founder #{family}</button> : <>founder #{family}</>}
      {` · ${relatives} alive`}</p>
    <p><span className="text-muted-foreground">Living offspring: </span>{offspring.length === 0 ? 'none alive' : <>
      {offspring.slice(0, 8).map((id, i) => <span key={id}>{i > 0 && ', '}<button type="button" className={link} onClick={() => choose({ species: s, id })}>#{id}</button></span>)}
      {offspring.length > 8 && ` and ${offspring.length - 8} more`}</>}</p>
  </div>
}

/** The inspector's rows: label, value and an optional explanation shown on hover. */
function facts(animal: Float32Array, species: Species): [string, string | number, string?][] {
  const rows: [string, string | number, string?][] = [
    ['Generation', animal[9]],
    ['Age', formatHours(animal[10])],
    ['Energy', `${Math.round(animal[5] * 100)}%`, 'Fuel left in the tank. At 0% the animal starves.'],
    ['Illness', animal[21] > 0 ? `Ill for up to ${formatHours(animal[21])} more` : 'None', 'Illness adds an energy drain; it is separate from hunger.'],
    ['Offspring', animal[13]],
    ['Body size', `×${(animal[ANIMAL_SIZE] || 1).toFixed(2)}`, 'Inherited, ×0.8 to ×1.25. Larger: more energy reserve and bigger bites, but slower, dearer to run and to breed, and a bigger meal. Hunger and illness never change it.'],
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
