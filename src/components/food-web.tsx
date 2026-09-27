import { iconFor, useAnimalIcons } from '@/hooks/use-animal-icons'
import { SPECIES_UI } from '@/game/species-ui'
import { THREE_SPECIES, type Species } from '@/sim/species'

type Row = { s: Species; eats: string; eatenBy: string }

const VOLE_ROWS: Row[] = [
  { s: 'prey', eats: 'Berries on the bushes', eatenBy: 'Foxes' },
  { s: 'vole', eats: 'Grass seed in the tall grass; berries when seed runs short', eatenBy: 'Foxes (a small meal)' },
  { s: 'pred', eats: 'Rabbits and voles', eatenBy: 'Nothing' },
]

/** The Wild meadow: a four-level chain (seed, voles, stoats, foxes) beside the rabbits, and deer that nothing hunts. */
const WILD_ROWS: Row[] = [
  { s: 'prey', eats: 'Berries on the bushes', eatenBy: 'Foxes; stoats take young rabbits' },
  { s: 'vole', eats: 'Grass seed in the tall grass; berries when seed runs short', eatenBy: 'Foxes and stoats' },
  { s: 'deer', eats: 'Berries in big bites, and grass seed', eatenBy: 'Nothing here' },
  { s: 'stoat', eats: 'Voles, even in the tall grass; young rabbits', eatenBy: 'Foxes (when they can catch one)' },
  { s: 'pred', eats: 'Rabbits, voles and stoats', eatenBy: 'Nothing' },
]

/** Who eats whom in the Vole meadow or the Wild meadow, in plain words (docs/third-species.md section 7). */
export function FoodWeb({ compact = false, species = THREE_SPECIES }: { compact?: boolean; species?: readonly Species[] }) {
  const icons = useAnimalIcons()
  const wild = species.includes('stoat')
  const rows = wild ? WILD_ROWS : VOLE_ROWS
  return (
    <section aria-labelledby={wild ? 'wild-web-heading' : 'food-web-heading'} className="rounded-lg border bg-muted/30 p-3 text-xs">
      <h3 id={wild ? 'wild-web-heading' : 'food-web-heading'} className="text-sm font-semibold">Who eats whom{wild ? ' in the Wild meadow' : ''}</h3>
      {wild ? (
        <p className="mt-1 text-muted-foreground">
          Seed feeds voles, voles feed stoats, and foxes eat stoats: a four-level chain. Deer browse the same berries and seed as rabbits and voles, and nothing here hunts them.
          {!compact && ' So a vole crash starves stoats first, culling foxes frees stoats to eat the voles down, and only your actions keep the deer in check.'}
        </p>
      ) : (
        <p className="mt-1 text-muted-foreground">
          Voles eat grass seed in the tall grass and nibble berries when seed runs short. Foxes eat voles and rabbits.
          {!compact && ' So voles compete with rabbits for berries, and voles feed the foxes: when voles crash, foxes turn to rabbits.'}
        </p>
      )}
      <table className="mt-2 w-full text-left">
        <thead className="text-muted-foreground">
          <tr><th className="pr-3 font-medium">Species</th><th className="pr-2 font-medium">Eats</th><th className="font-medium">Eaten by</th></tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.s} className="align-top">
              <td className="py-0.5 pr-3 whitespace-nowrap">
                <span className="flex items-center gap-1">
                  <img src={iconFor(icons, r.s)} alt="" className="size-5" />
                  <span className={`font-semibold ${SPECIES_UI[r.s].text}`}>{SPECIES_UI[r.s].Plural}</span>
                </span>
              </td>
              <td className="py-0.5 pr-2">{r.eats}</td>
              <td className="py-0.5">{r.eatenBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-muted-foreground">
        {wild
          ? 'All five must survive the year. Tall grass hides rabbits and voles from foxes, but not voles from stoats.'
          : 'All three must survive the year. The Tall grass lever now feeds voles as well as hiding rabbits.'}
      </p>
    </section>
  )
}
