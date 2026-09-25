import { useMemo } from 'react'
import type { AnimalSelection } from '@/components/animal-inspector'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { useGame } from '@/hooks/use-game'
import { FAMILY_ARCHIVE, FAMILY_DAYS, type LineageSummary } from '@/game/families'
import { CATEGORY, JOURNAL_LIMIT, TRAIT_LABEL, TRAIT_SHIFT, type JournalCategory, type JournalEntry } from '@/game/journal'
import type { Species } from '@/sim/sim'
import { ANIMAL_STRIDE } from '@/worker/protocol'
import { cn } from '@/lib/utils'
import { displayOrder, framePop, SPECIES_UI } from '@/game/species-ui'

const link = 'font-medium text-primary underline-offset-2 hover:underline'
const day = (tick: number) => Math.floor(tick / 24) + 1
const f2 = (v: number) => v.toFixed(2)
const NAME: Record<Species, [string, string]> = { prey: ['Rabbit', 'rabbits'], pred: ['Fox', 'foxes'], vole: ['Vole', 'voles'] }
const TAG: Record<JournalCategory, [string, string]> = {
  family: ['Family', 'Who is descended from whom: counted, not explained.'],
  inherited: ['Measured change', 'A change in inherited tendencies, measured the same way every day. It is not evidence of an advantage.'],
  outcome: ['Population outcome', 'What happened to a population. It does not say which traits, if any, were responsible.'],
}

/** The journal: observations newest first, each with its category, links and the measurement behind it. */
export function EvolutionJournal({ onInspect, onFamily }: { onInspect: (a: AnimalSelection) => void; onFamily: (f: AnimalSelection) => void }) {
  const [game, snap] = useGame()
  const log = game.history.log
  const entries = log.entries.filter(e => e.tick <= snap.tick).reverse()
  const chart = (e: JournalEntry) => e.kind === 'traitShift'
    ? () => document.getElementById(`trait-${e.species}-${e.evidence.trait}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : null
  return <Card className="gap-0 p-4">
    <h3 className="text-sm font-semibold">Evolution journal</h3>
    <p className="mt-1 text-xs text-muted-foreground">
      Observations, newest first. Each entry shows the measurement behind it; none explains why something happened.
      {' '}Keeps the latest {JOURNAL_LIMIT} entries{log.dropped > 0 && `; ${log.dropped} older ${log.dropped === 1 ? 'entry was' : 'entries were'} dropped`}.
    </p>
    {entries.length > 0
      ? <ul className="mt-2 max-h-[60vh] space-y-2 overflow-y-auto text-xs">{entries.map(e => {
        const [tag, tip] = TAG[CATEGORY[e.kind]]
        const toChart = chart(e)
        return <li key={`${e.tick}-${e.kind}-${e.text}`} className="rounded-md border p-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={CATEGORY[e.kind] === 'inherited' ? 'secondary' : 'outline'} title={tip}>{tag}</Badge>
            <span className="text-muted-foreground">Day {day(e.tick)}</span>
          </div>
          <p className="mt-1">{e.text}</p>
          {e.caveat && <p className="mt-1 text-muted-foreground italic">{e.caveat}</p>}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {e.animal && <button type="button" className={link} onClick={() => onInspect(e.animal!)}>Inspect {NAME[e.animal.species][0].toLowerCase()} #{e.animal.id}</button>}
            {e.lineage && <button type="button" className={link} onClick={() => onFamily(e.lineage!)}>Family of founder #{e.lineage.id}</button>}
            {toChart && <button type="button" className={link} onClick={toChart}>See the chart</button>}
          </div>
          <details className="mt-1">
            <summary className="cursor-pointer text-muted-foreground">Evidence</summary>
            <Evidence entry={e} />
          </details>
        </li>
      })}</ul>
      : <p className="mt-2 text-xs text-muted-foreground">Generation, family and trait milestones will appear as the meadow evolves.</p>}
  </Card>
}

function Evidence({ entry: e }: { entry: JournalEntry }) {
  const box = 'mt-1 space-y-1 rounded bg-muted/40 p-2'
  switch (e.kind) {
    case 'generation':
      return <div className={box}>Source: the highest generation among living {NAME[e.species][1]} in the daily sample. Recorded the first time it reaches a new multiple of {e.evidence.every}: generation {e.evidence.generation}.</div>
    case 'lineage':
      return <div className={box}>Source: founder families among living {NAME[e.species][1]} in the daily sample: {e.evidence.from} the day before, {e.evidence.to} now.</div>
    case 'extinction':
      return <div className={box}>Source: living {NAME[e.species][1]} in the daily samples: {e.evidence.lastCount} on day {day(e.evidence.lastSeen)}, none on day {day(e.tick)}.</div>
    case 'year':
      return <div className={box}>Source: living animals at the first daily sample of year {e.evidence.year}: {e.evidence.prey} rabbits, {e.evidence.vole !== undefined && `${e.evidence.vole} voles, `}{e.evidence.pred} foxes.</div>
    case 'traitShift': {
      const v = e.evidence
      return <div className={box}>
        <table className="w-full tabular">
          <thead><tr className="text-muted-foreground"><th className="text-left font-normal">{TRAIT_LABEL[v.trait]}</th><th className="text-right font-normal">Mean</th><th className="text-right font-normal">Middle 80%</th></tr></thead>
          <tbody>
            <tr><td>{v.baseline.tick === 0 ? 'Founders (day 1)' : `First measured (day ${day(v.baseline.tick)})`}</td><td className="text-right">{f2(v.baseline.mean)}</td><td className="text-right">{f2(v.baseline.low)} to {f2(v.baseline.high)}</td></tr>
            <tr><td>Day {day(v.now.tick)}</td><td className="text-right">{f2(v.now.mean)}</td><td className="text-right">{f2(v.now.low)} to {f2(v.now.high)}</td></tr>
          </tbody>
        </table>
        <p>Rule: the mean stayed at least {v.threshold} {v.direction > 0 ? 'above' : 'below'} the first measurement for {v.samples} daily samples in a row (days {day(v.since)} to {day(v.now.tick)}), each with at least {TRAIT_SHIFT.minCount} animals (fewest: {v.fewest}). Recorded once per direction; it can be recorded again only after the mean comes back within {TRAIT_SHIFT.release}.</p>
      </div>
    }
    case 'variety':
      return <div className={box}>
        <p>Measured: {e.evidence.measure}. Rule: {e.evidence.threshold}. Since day {day(e.evidence.since)} ({e.evidence.samples} daily samples).</p>
        <p className="tabular">{Object.entries(e.evidence.values).map(([k, v]) => `${k}: ${f2(v)}`).join(' · ')}</p>
      </div>
    case 'note':
      return <div className={box}>Recorded by an earlier version of the game, which did not store its measurement.</div>
  }
}

/** Founder families: share of the living animals, and the history of the chosen family. */
export function FamiliesCard({ family, onFamily, onInspect, endless }: { family: AnimalSelection | null; onFamily: (f: AnimalSelection) => void; onInspect: (a: AnimalSelection) => void; endless: boolean }) {
  const [game, snap] = useGame()
  const families = game.history.families
  const counted = families.days.length
  const upto = Math.floor(snap.tick / 24)
  // Rebuild when a daily count is added or the displayed day changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const species = displayOrder(game.scenario.species)
  const all = useMemo(() => Object.fromEntries(species.map(s => [s, families.summaries(s, snap.tick)])) as Record<Species, LineageSummary[]>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [families, counted, upto, species.length])
  const from = families.countedFrom
  return <Card id="families" className="gap-3 p-4">
    <div>
      <h3 className="font-semibold">Families</h3>
      <p className="mt-1 max-w-[80ch] text-xs text-muted-foreground">
        Each founder’s descendants, counted once a day. A large family shows who left descendants, not why.
        {endless && ` Daily counts cover the last ${FAMILY_DAYS} days${from !== null && from > 0 ? ` (from day ${day(from)})` : ''}; older days keep only each family’s first count and largest size, and only the ${FAMILY_ARCHIVE} most recently seen extinct families per species are kept.`}
      </p>
    </div>
    <div className={species.length > 2 ? 'grid gap-3 md:grid-cols-3' : 'grid gap-3 md:grid-cols-2'}>
      {species.map(s => <Shares key={s} species={s} list={all[s]} focus={family} onFamily={onFamily} />)}
    </div>
    {family && <FamilyDetail family={family} summary={all[family.species]?.find(l => l.founder === family.id)} onInspect={onInspect} />}
  </Card>
}

function Shares({ species, list, focus, onFamily }: { species: Species; list: LineageSummary[]; focus: AnimalSelection | null; onFamily: (f: AnimalSelection) => void }) {
  const living = list.filter(l => l.living > 0)
  const total = living.reduce((n, l) => n + l.living, 0)
  const top = living.slice(0, 5)
  const rest = total - top.reduce((n, l) => n + l.living, 0)
  const tone = SPECIES_UI[species].bg
  const pct = (n: number) => `${Math.round(n / total * 100)}%`
  return <section aria-label={`${NAME[species][0]} families`} className="rounded-lg border bg-muted/30 p-3 text-xs">
    <h4 className={cn('text-xs font-semibold tracking-wide uppercase', SPECIES_UI[species].text)}>{NAME[species][1]}: {living.length} {living.length === 1 ? 'family' : 'families'} alive</h4>
    {total > 0 ? <>
      <div className="mt-2 flex h-3 overflow-hidden rounded-sm bg-muted" role="img" aria-label={`Share of living ${NAME[species][1]} by family`}>
        {top.map((l, i) => <div key={l.founder} className={tone} style={{ width: pct(l.living), opacity: 1 - i * 0.16 }} title={`Founder #${l.founder}: ${l.living} (${pct(l.living)})`} />)}
      </div>
      <ul className="mt-2 space-y-0.5">
        {top.map(l => <li key={l.founder}>
          <button type="button" className={cn(link, focus?.species === species && focus.id === l.founder && 'underline')} onClick={() => onFamily({ species, id: l.founder })}>Founder #{l.founder}</button>
          <span className="text-muted-foreground"> · {l.living} alive ({pct(l.living)}) · generations {l.minGen}–{l.maxGen}</span>
        </li>)}
        {rest > 0 && <li className="text-muted-foreground">Other families: {rest} ({pct(rest)})</li>}
      </ul>
    </> : <p className="mt-2 text-muted-foreground">None alive at the displayed time.</p>}
  </section>
}

function FamilyDetail({ family, summary, onInspect }: { family: AnimalSelection; summary: LineageSummary | undefined; onInspect: (a: AnimalSelection) => void }) {
  const [game, snap] = useGame()
  const frame = game.history.frameAt(snap.tick)?.a
  const rows = frame && framePop(frame, family.species)
  const members: [number, number][] = []
  if (rows) for (let i = 0; i < rows.length; i += ANIMAL_STRIDE) if (rows[i + 12] === family.id) members.push([rows[i], rows[i + 9]])
  members.sort((a, b) => b[1] - a[1] || a[0] - b[0])
  const [one, many] = NAME[family.species]
  return <section aria-label="Family history" className="rounded-lg border p-3 text-xs">
    <h4 className="text-sm font-semibold">{one} family of founder #{family.id}</h4>
    {summary ? <p className="mt-1">
      First counted on day {day(summary.firstSeen)}. Generations {summary.minGen} to {summary.maxGen}. Largest: {summary.peak} {summary.peak === 1 ? one.toLowerCase() : many} on day {day(summary.peakTick)}.
      {' '}{summary.living > 0 ? `${summary.living} alive at the latest daily count.` : `Died out: last counted on day ${day(summary.lastSeen)}.`}
    </p> : <p className="mt-1 text-muted-foreground">No count of this family is kept at the displayed time: it was counted only after this day, or its record was dropped to keep the history bounded.</p>}
    <p className="mt-2 text-muted-foreground">Alive at the displayed time, newest generation first:</p>
    {members.length > 0 ? <p className="mt-1">
      {members.slice(0, 12).map(([id, gen], i) => <span key={id}>{i > 0 && ', '}<button type="button" className={link} onClick={() => onInspect({ species: family.species, id })}>#{id}</button> <span className="text-muted-foreground">(gen {gen})</span></span>)}
      {members.length > 12 && ` and ${members.length - 12} more`}
    </p> : <p className="mt-1 text-muted-foreground">None.</p>}
  </section>
}
