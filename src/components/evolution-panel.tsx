import { useState } from 'react'
import { useGame } from '@/hooks/use-game'
import { TRAITS, type TraitKey } from '@/sim/evolution'
import type { Species } from '@/sim/sim'
import { formatHours } from '@/sim/time'
import { ANIMAL_SIZE, ANIMAL_STRIDE } from '@/worker/protocol'

export interface AnimalSelection { species: Species; id: number }
const LABELS: Record<TraitKey, string> = { forage: 'Food seeking', flee: 'Threat avoidance', cruise: 'Cruising pace', hide: 'Cover seeking', size: 'Body size' }
export function EvolutionPanel({ selected, onSelect }: { selected: AnimalSelection | null; onSelect: (a: AnimalSelection | null) => void }) {
  const [game, snap] = useGame()
  const [species, setSpecies] = useState<Species>('prey')
  const [trait, setTrait] = useState<TraitKey>('forage')
  const samples = game.history.evolution.filter(s => s.tick <= snap.tick)
  const latest = samples.at(-1)
  const first = samples[0]
  const pop = latest?.[species]
  const frame = game.history.frameAt(snap.tick)?.a
  const animals = species === 'prey' ? frame?.prey : frame?.preds
  const options: number[] = []
  if (animals) for (let i = 0; i < animals.length; i += ANIMAL_STRIDE) options.push(animals[i])
  const inspected = selected && frame ? (selected.species === 'prey' ? frame.prey : frame.preds) : null
  let animal: Float32Array | null = null
  if (inspected && selected) for (let i = 0; i < inspected.length; i += ANIMAL_STRIDE)
    if (inspected[i] === selected.id) animal = inspected.subarray(i, i + ANIMAL_STRIDE)
  const color = species === 'prey' ? '#dcc7a3' : '#ec8a45'
  const from = samples.length >= 367 ? samples[1].tick : samples[0]?.tick ?? 0
  const end = Math.max(from + 24, latest?.tick ?? 24)
  const plotted = samples.filter(s => s.tick >= from)
  const x = (tick: number) => 30 + (tick - from) / (end - from) * 290
  const y = (value: number) => 126 - (value + 1) * 52
  const line = plotted.map(s => `${x(s.tick)},${y(s[species].traits[trait].mean)}`).join(' ')
  const band = [...plotted.map(s => `${x(s.tick)},${y(s[species].traits[trait].high)}`),
    ...[...plotted].reverse().map(s => `${x(s.tick)},${y(s[species].traits[trait].low)}`)].join(' ')
  const cls = 'rounded-md border bg-background px-2 py-1.5 text-sm'
  return <div className="flex flex-col gap-4">
    <div><h2 className="font-semibold">Evolution in the meadow</h2>
      <p className="mt-1 text-xs text-muted-foreground">Inherited responses measured in the same test situations. These are tendencies, not an animal’s current movement.</p></div>
    <div className="flex gap-2">
      <select className={cls} aria-label="Evolution species" value={species} onChange={e => setSpecies(e.target.value as Species)}>
        <option value="prey">Rabbits</option><option value="pred">Foxes</option>
      </select>
      <select className={cls + ' min-w-0 flex-1'} aria-label="Inherited trait" value={trait} onChange={e => setTrait(e.target.value as TraitKey)}>
        {TRAITS.map(k => <option key={k} value={k}>{LABELS[k]}</option>)}
      </select>
    </div>
    <section className="rounded-lg border bg-muted/20 p-3">
      <div className="flex justify-between text-sm"><span>{LABELS[trait]}</span><strong style={{ color }}>{pop?.traits[trait].mean.toFixed(2) ?? '—'}</strong></div>
      <svg viewBox="0 0 340 152" className="mt-2 w-full" role="img" aria-label={`${LABELS[trait]} over time; average and middle 80 percent of ${species === 'prey' ? 'rabbits' : 'foxes'}`}>
        {[-1, 0, 1].map(v => <g key={v}><line x1="30" x2="320" y1={y(v)} y2={y(v)} stroke="currentColor" opacity="0.12" /><text x="4" y={y(v) + 3} fill="currentColor" fontSize="10">{v}</text></g>)}
        {first && <line x1="30" x2="320" y1={y(first[species].traits[trait].mean)} y2={y(first[species].traits[trait].mean)} stroke={color} strokeDasharray="4 4" opacity="0.5" />}
        <polygon points={band} fill={color} opacity="0.2" /><polyline points={line} fill="none" stroke={color} strokeWidth="2" />
        <text x="30" y="147" fill="currentColor" fontSize="10">Day {Math.floor(from / 24) + 1}</text>
        <text x="320" y="147" textAnchor="end" fill="currentColor" fontSize="10">Day {Math.floor(end / 24) + 1}</text>
      </svg>
      <p className="text-[11px] text-muted-foreground">Line: mean · band: middle 80% · dashed: founders. {trait === 'cruise' ? '0 = resting, 1 = maximum pace.' : trait === 'size' ? 'Inherited body size: 1 = the usual body, 0.8 small to 1.25 large (only with body evolution on).' : 'Positive = stronger response; negative = the opposite.'}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div><strong className="block text-lg">{pop?.generation ?? 0}</strong>Highest living generation</div>
        <div><strong className="block text-lg">{pop?.lineages ?? 0}</strong>Founder lineages</div>
        <div><strong className="block text-lg">{species === 'prey' ? snap.prey : snap.pred}</strong>Animals now</div>
      </div>
    </section>
    <section className="rounded-lg border p-3">
      <h3 className="text-sm font-semibold">Animal inspector</h3>
      <p className="mt-1 text-xs text-muted-foreground">Click an animal in the meadow, or choose one below. The meadow pauses for inspection.</p>
      <select className={cls + ' mt-2 w-full'} aria-label="Inspect an animal" value={selected?.species === species && options.includes(selected.id) ? selected.id : ''}
        onChange={e => { if (e.target.value) { game.pause(); onSelect({ species, id: Number(e.target.value) }) } else onSelect(null) }}>
        <option value="">Choose {species === 'prey' ? 'a rabbit' : 'a fox'}…</option>
        {options.map(id => <option key={id} value={id}>{species === 'prey' ? 'Rabbit' : 'Fox'} #{id}</option>)}
      </select>
      {selected && <div className="mt-3 text-sm">
        <strong>{selected.species === 'prey' ? 'Rabbit' : 'Fox'} #{selected.id}</strong>
        {animal ? <><dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {Object.entries({ Generation: animal[9], Age: formatHours(animal[10]), Energy: `${Math.round(animal[5] * 100)}%`,
            Health: animal[21] > 0 ? `Ill for up to ${formatHours(animal[21])} more` : 'Well', Offspring: animal[13], Parent: animal[11] < 0 ? 'Founder / arrival' : `#${animal[11]}`, Lineage: `#${animal[12]}`,
            'Sight range': `${Math.round(animal[14] * 100)}% of meadow`, 'Hidden units': animal[16],
            'Body size (inherited)': `×${(animal[ANIMAL_SIZE] || 1).toFixed(2)}`,
            'Food seeking': animal[17].toFixed(2), 'Threat avoidance': animal[18].toFixed(2), 'Cruising pace': animal[19].toFixed(2), 'Cover seeking': animal[20].toFixed(2),
          }).map(([k,v]) => <div key={k}><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}
        </dl></> : <p className="mt-2 text-xs text-muted-foreground">This animal is no longer present at the displayed time. Scrub back to inspect its earlier life.</p>}
      </div>}
    </section>
    <section><h3 className="text-sm font-semibold">Evolution journal</h3>
      <p className="mt-1 text-xs text-muted-foreground">Observed milestones. Trait changes alone do not prove an advantage.</p>
      <ul className="mt-2 space-y-2 text-xs">{game.history.journal.filter(e => e.tick <= snap.tick).slice(-6).reverse().map(e => <li key={`${e.tick}-${e.text}`} className="rounded-md border p-2"><span className="text-muted-foreground">Day {Math.floor(e.tick / 24) + 1} · </span>{e.text}</li>)}</ul>
      {!game.history.journal.some(e => e.tick <= snap.tick) && <p className="mt-2 text-xs text-muted-foreground">Generation and lineage milestones will appear as the meadow evolves.</p>}
    </section>
  </div>
}
