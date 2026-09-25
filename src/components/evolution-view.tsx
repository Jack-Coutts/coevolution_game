import { AnimalInspector, type AnimalSelection } from '@/components/animal-inspector'
import { TraitChart } from '@/components/trait-chart'
import { Card } from '@/components/ui/card'
import { useAnimalIcons } from '@/hooks/use-animal-icons'
import { useGame } from '@/hooks/use-game'
import { TRAITS } from '@/sim/evolution'
import type { Species } from '@/sim/sim'

const SPECIES: { id: Species; name: string; tone: string }[] = [
  { id: 'prey', name: 'Rabbits', tone: 'text-rabbit' },
  { id: 'pred', name: 'Foxes', tone: 'text-fox' },
]

export function EvolutionView({ selected, onSelect }: { selected: AnimalSelection | null; onSelect: (a: AnimalSelection | null) => void }) {
  const [game, snap] = useGame()
  const icons = useAnimalIcons()
  const samples = game.history.evolution.filter(s => s.tick <= snap.tick)
  const latest = samples.at(-1)
  const journal = game.history.journal.filter(e => e.tick <= snap.tick).reverse()
  return <div className="flex flex-col gap-3">
    <Card className="gap-3 p-4">
      <div>
        <h2 className="text-lg font-semibold">Evolution in the meadow</h2>
        <p className="mt-1 max-w-[80ch] text-sm text-muted-foreground">Inherited responses measured in the same test situations. These are tendencies, not an animal’s current movement.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {SPECIES.map(s => <div key={s.id} className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
            <img src={s.id === 'prey' ? icons.rabbit : icons.fox} alt="" className="size-5" />
            <span className={s.tone}>{s.name}</span>
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <Tile label="Highest living generation" value={latest?.[s.id].generation ?? 0} />
            <Tile label="Founder lineages" value={latest?.[s.id].lineages ?? 0} />
            <Tile label="Animals now" value={s.id === 'prey' ? snap.prey : snap.pred} />
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
          {TRAITS.map(t => <TraitChart key={t} samples={samples} species={s.id} trait={t} />)}
        </div>
      </section>)}
    </Card>

    <div className="grid items-start gap-3 lg:grid-cols-2">
      <AnimalInspector picker selected={selected} onSelect={onSelect} />
      <Card className="gap-0 p-4">
        <h3 className="text-sm font-semibold">Evolution journal</h3>
        <p className="mt-1 text-xs text-muted-foreground">Observed milestones, newest first. Trait changes alone do not prove an advantage.</p>
        {journal.length > 0
          ? <ul className="mt-2 max-h-[60vh] space-y-2 overflow-y-auto text-xs">{journal.map(e => <li key={`${e.tick}-${e.text}`} className="rounded-md border p-2"><span className="text-muted-foreground">Day {Math.floor(e.tick / 24) + 1} · </span>{e.text}</li>)}</ul>
          : <p className="mt-2 text-xs text-muted-foreground">Generation and lineage milestones will appear as the meadow evolves.</p>}
      </Card>
    </div>
  </div>
}

function Tile({ label, value }: { label: string; value: number }) {
  return <div className="flex flex-col-reverse rounded-md bg-card p-2 text-center">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="text-lg font-semibold tabular">{value}</dd>
  </div>
}
