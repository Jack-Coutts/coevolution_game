import { iconFor, useAnimalIcons } from '@/hooks/use-animal-icons'
import { SPECIES_UI } from '@/game/species-ui'
import type { Species } from '@/sim/species'

const ROWS: { s: Species; eats: string; eatenBy: string }[] = [
  { s: 'prey', eats: 'Berries on the bushes', eatenBy: 'Foxes' },
  { s: 'vole', eats: 'Grass seed in the tall grass; berries when seed runs short', eatenBy: 'Foxes (a small meal)' },
  { s: 'pred', eats: 'Rabbits and voles', eatenBy: 'Nothing' },
]

/** Who eats whom in the Vole meadow, in plain words (docs/third-species.md section 7). */
export function FoodWeb({ compact = false }: { compact?: boolean }) {
  const icons = useAnimalIcons()
  return (
    <section aria-labelledby="food-web-heading" className="rounded-lg border bg-muted/30 p-3 text-xs">
      <h3 id="food-web-heading" className="text-sm font-semibold">Who eats whom</h3>
      <p className="mt-1 text-muted-foreground">
        Voles eat grass seed in the tall grass and nibble berries when seed runs short. Foxes eat voles and rabbits.
        {!compact && ' So voles compete with rabbits for berries, and voles feed the foxes: when voles crash, foxes turn to rabbits.'}
      </p>
      <table className="mt-2 w-full text-left">
        <thead className="text-muted-foreground">
          <tr><th className="font-medium">Species</th><th className="font-medium">Eats</th><th className="font-medium">Eaten by</th></tr>
        </thead>
        <tbody>
          {ROWS.map(r => (
            <tr key={r.s} className="align-top">
              <td className="py-0.5 pr-2">
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
      <p className="mt-2 text-muted-foreground">All three must survive the year. The Tall grass lever now feeds voles as well as hiding rabbits.</p>
    </section>
  )
}
