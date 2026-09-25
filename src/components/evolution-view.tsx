import { useMemo, useRef, useState } from 'react'
import { AnimalInspector, type AnimalSelection } from '@/components/animal-inspector'
import { EvolutionJournal, FamiliesCard } from '@/components/journal'
import { TraitChart, type TraitSeries } from '@/components/trait-chart'
import { Card } from '@/components/ui/card'
import { iconFor, useAnimalIcons } from '@/hooks/use-animal-icons'
import { displayOrder, SPECIES_UI } from '@/game/species-ui'
import { useGame } from '@/hooks/use-game'
import { TRAITS, type EvolutionSample } from '@/sim/evolution'
import type { Species } from '@/sim/sim'

function traitSeries(samples: EvolutionSample[]): TraitSeries {
  // Once history is trimmed, samples[0] is the founders sample far behind the rest; keep it only for the dashed line.
  const trimmed = samples.length > 1 && samples[1].tick - samples[0].tick > 24
  const plotted = trimmed ? samples.slice(1) : samples
  const from = plotted[0]?.tick ?? 0
  return { plotted, founders: samples[0], from, end: Math.max(from + 24, samples.at(-1)?.tick ?? 24) }
}

const speciesRows = (species: readonly Species[]) =>
  displayOrder(species).map(id => ({ id, name: SPECIES_UI[id].Plural, tone: SPECIES_UI[id].text }))

export function EvolutionView({ selected, onSelect }: { selected: AnimalSelection | null; onSelect: (a: AnimalSelection | null) => void }) {
  const [game, snap] = useGame()
  const icons = useAnimalIcons()
  const evolution = game.history.evolution
  let last = evolution.length - 1
  while (last >= 0 && evolution[last].tick > snap.tick) last--
  const lastTick = evolution[last]?.tick
  // The controller notifies ~10 times a second even when paused; rebuild the charts only when the visible samples change.
  // History mutates the array in place (push, then trim to a fixed length), so its length and last tick are part of the key.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const series = useMemo(() => traitSeries(evolution.slice(0, last + 1)), [evolution, evolution.length, last, lastTick])
  const latest = series.plotted.at(-1)
  const SPECIES = speciesRows(game.scenario.species)
  const now: Record<Species, number> = { prey: snap.prey, pred: snap.pred, vole: snap.vole }
  const [family, setFamily] = useState<AnimalSelection | null>(null)
  const inspector = useRef<HTMLElement>(null)
  const inspect = (a: AnimalSelection) => {
    game.pause()
    onSelect(a)
    inspector.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
  const showFamily = (f: AnimalSelection) => {
    setFamily(f)
    requestAnimationFrame(() => document.getElementById('families')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }
  return <div className="flex flex-col gap-3">
    <Card className="gap-3 p-4">
      <div>
        <h2 className="text-lg font-semibold">Evolution in the meadow</h2>
        <p className="mt-1 max-w-[80ch] text-sm text-muted-foreground">Inherited responses measured in the same test situations. These are tendencies, not an animal’s current movement.</p>
      </div>
      <div className={SPECIES.length > 2 ? 'grid gap-3 md:grid-cols-3' : 'grid gap-3 md:grid-cols-2'}>
        {SPECIES.map(s => <div key={s.id} className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
            <img src={iconFor(icons, s.id)} alt="" className="size-5" />
            <span className={s.tone}>{s.name}</span>
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <Tile label="Highest living generation" value={latest?.[s.id].count === 0 ? '—' : latest?.[s.id].generation ?? 0} />
            <Tile label="Founder lineages" value={latest?.[s.id].count === 0 ? '—' : latest?.[s.id].lineages ?? 0} />
            <Tile label="Animals now" value={now[s.id]} />
          </dl>
        </div>)}
      </div>
    </Card>

    <Card className="gap-3 p-4">
      <div>
        <h3 className="font-semibold">Inherited traits</h3>
        <p className="mt-1 text-xs text-muted-foreground">Line: mean · band: middle 80% · dashed: founders. Cruising pace runs from 0 = resting to 1 = maximum pace; for the other traits, positive = stronger response and negative = the opposite.</p>
      </div>
      {SPECIES.map(s => <section key={s.id} aria-label={`${s.name} traits`}>
        <h4 className={`mb-2 text-xs font-semibold tracking-wide uppercase ${s.tone}`}>{s.name}</h4>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {TRAITS.map(t => <div key={t} id={`trait-${s.id}-${t}`} className="scroll-mt-4"><TraitChart series={series} species={s.id} trait={t} /></div>)}
        </div>
      </section>)}
    </Card>

    <div className="grid items-start gap-3 lg:grid-cols-2">
      <AnimalInspector ref={inspector} picker selected={selected} onSelect={onSelect} onFamily={showFamily} />
      <EvolutionJournal onInspect={inspect} onFamily={showFamily} />
    </div>

    <FamiliesCard family={family} onFamily={showFamily} onInspect={inspect} endless={snap.endless} />
  </div>
}

function Tile({ label, value }: { label: string; value: number | string }) {
  return <div className="flex flex-col-reverse rounded-md bg-card p-2 text-center">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="text-lg font-semibold tabular">{value}</dd>
  </div>
}
