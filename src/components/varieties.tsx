import { Card } from '@/components/ui/card'
import { useGame } from '@/hooks/use-game'
import { displayOrder, SPECIES_UI } from '@/game/species-ui'
import { DIMS, dimLabel, dimText, mainDifference, VARIETY, type VarietyDay } from '@/game/varieties'
import type { Species } from '@/sim/sim'
import { cn } from '@/lib/utils'

const day = (tick: number) => Math.floor(tick / 24) + 1
const pct = (v: number) => `${Math.round(v * 100)}%`
const NAME: Record<Species, [string, string]> = { prey: ['Rabbit', 'Rabbits'], pred: ['Fox', 'Foxes'], vole: ['Vole', 'Voles'] }

/** Observed ecological varieties per species at the displayed day: shares, trait centroids and the evidence for them. */
export function VarietiesCard() {
  const [game, snap] = useGame()
  const record = game.history.varieties.at(snap.tick)
  const species = displayOrder(game.scenario.species)
  return <Card id="varieties" className="gap-3 p-4">
    <div>
      <h3 className="font-semibold">Observed ecological varieties</h3>
      <p className="mt-1 max-w-[80ch] text-xs text-muted-foreground">
        Groups within a species whose inherited traits differ, found once a day by splitting each species into the two most different groups.
        A split counts when there is a clear gap between the groups (separation above {VARIETY.minSeparation}), the smaller group has at least {pct(VARIETY.minShare)} of
        the animals and the groups are at least {VARIETY.minDistance} apart. It gets names only after {VARIETY.persistDays} daily samples in a row across at
        least {VARIETY.persistGenerations} generations, and loses them after {VARIETY.releaseDays} days without it. These are not subspecies, and they are
        not families: a variety can mix animals from several founders.
      </p>
    </div>
    <div className={species.length > 2 ? 'grid gap-3 md:grid-cols-3' : 'grid gap-3 md:grid-cols-2'}>
      {species.map(s => <SpeciesVarieties key={s} species={s} day={record?.[s]} />)}
    </div>
  </Card>
}

function SpeciesVarieties({ species, day: d }: { species: Species; day: VarietyDay | undefined }) {
  const [one, many] = NAME[species]
  const split = d?.split
  const named = d?.ids && split && 'c' in split ? { ids: d.ids, split } : null
  return <section aria-label={`${one} varieties`} className="rounded-lg border bg-muted/30 p-3 text-xs">
    <h4 className={cn('text-xs font-semibold tracking-wide uppercase', SPECIES_UI[species].text)}>
      {many}: {named ? 'two varieties' : 'no named varieties'}
    </h4>
    {!d ? <p className="mt-2 text-muted-foreground">Not measured yet: the first daily sample comes at midnight.</p>
      : named ? <Named species={species} ids={named.ids} split={named.split} since={d.since} />
      : <p className="mt-2 text-muted-foreground">{d.count < VARIETY.minCount ? `Too few to measure: ${d.count} alive (at least ${VARIETY.minCount} needed).`
        : d.candidate ? `A possible split: seen for ${d.candidate.samples} of ${VARIETY.persistDays} daily samples in a row (since day ${day(d.candidate.since)}), across ${d.candidate.generations.toFixed(1)} of ${VARIETY.persistGenerations} generations.`
        : d.since !== undefined ? `Varieties named since day ${day(d.since)} are not seen as separate groups today; they lose their names after ${VARIETY.releaseDays} such days.`
        : 'One group: no clear split today.'}</p>}
    {split && <p className="mt-2 text-muted-foreground tabular" title="Today's measurement. Separation compares the animals midway between the two groups with those around the smaller group: 1 means an empty gap, 0 or less means no gap.">
      Today: separation {split.sep.toFixed(2)} · smaller group {pct(split.share[1])} · distance {split.dist.toFixed(2)}
    </p>}
  </section>
}

function Named({ species, ids, split, since }: { species: Species; ids: [number, number]; split: { share: [number, number]; c: [number[], number[]] }; since?: number }) {
  const tone = SPECIES_UI[species].bg
  const main = mainDifference(split).trait
  return <>
    <div className="mt-2 flex h-3 overflow-hidden rounded-sm bg-muted" role="img" aria-label={`Share of living ${NAME[species][1].toLowerCase()} by variety`}>
      {ids.map((id, i) => <div key={id} className={tone} style={{ width: pct(split.share[i]), opacity: i === 0 ? 1 : 0.5 }} title={`Variety ${id}: ${pct(split.share[i])}`} />)}
    </div>
    {since !== undefined && <p className="mt-1 text-muted-foreground">Seen as separate groups since day {day(since)}.</p>}
    <table className="mt-2 w-full tabular">
      <thead><tr className="text-muted-foreground"><th className="text-left font-normal">Group centre</th>
        {ids.map((id, i) => <th key={id} className="text-right font-normal">Variety {id} ({pct(split.share[i])})</th>)}</tr></thead>
      <tbody>{DIMS.map((dim, j) => <tr key={dim.key} className={cn(dim.key === main && 'font-semibold')}>
        <td>{dimLabel(dim.key)}</td>{ids.map((id, i) => <td key={id} className="text-right">{dimText(dim.key, split.c[i][j])}</td>)}
      </tr>)}</tbody>
    </table>
  </>
}
