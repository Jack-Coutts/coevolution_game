import { useAnimalIcons } from '@/hooks/use-animal-icons'
import { useGame } from '@/hooks/use-game'
import { FoodWeb } from '@/components/food-web'

const KEYS: [string, string][] = [
  ['Space', 'Play / pause'],
  ['← →', 'Back / forward one day (Shift: one hour)'],
  ['↑ ↓', 'Faster / slower'],
  ['Home End', 'Jump to start / live'],
  ['R', 'Reset the run (asks first once it has run a week)'],
]

export function Guide() {
  const icons = useAnimalIcons()
  const [game] = useGame()
  const voles = game.scenario.species.includes('vole')
  return (
    <div className="gap-10 text-sm leading-relaxed lg:columns-2 [&>section]:mb-5 [&>section]:max-w-[70ch] [&>section]:break-inside-avoid">
      <section>
        <h3 className="mb-1 font-semibold">Goal</h3>
        <p className="text-muted-foreground">
          {voles
            ? <>In the Vole meadow, keep <b className="text-rabbit">rabbits</b>, <b className="text-vole">voles</b> and <b className="text-fox">foxes</b> alive together from 1 September to the following September. The run ends as soon as any of the three dies out; Endless continues past the first year on the same rule.</>
            : <>Keep <b className="text-rabbit">rabbits</b> and <b className="text-fox">foxes</b> alive together from 1
          September to the following September. Endless mode continues past the first year, until either species dies out.</>}
        </p>
      </section>
      <section className={voles ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-2'}>
        <div className="flex items-center gap-2 rounded-lg border p-2">
          <img src={icons.rabbit} alt="" className="size-8" />
          <span className="text-xs text-muted-foreground">
            Rabbits graze the berry bushes. Bushes shrink as they are eaten.
          </span>
        </div>
        {voles && (
          <div className="flex items-center gap-2 rounded-lg border p-2">
            <img src={icons.vole} alt="" className="size-8" />
            <span className="text-xs text-muted-foreground">Voles eat grass seed, and berries when seed runs short. A vole is a small meal for a fox.</span>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-lg border p-2">
          <img src={icons.fox} alt="" className="size-8" />
          <span className="text-xs text-muted-foreground">{voles ? 'Foxes hunt rabbits and voles. A full fox stops hunting.' : 'Foxes hunt rabbits. A full fox stops hunting.'}</span>
        </div>
      </section>
      <section>
        <h3 className="mb-1 font-semibold">The Vole meadow</h3>
        <p className="mb-2 text-muted-foreground">
          The fifth scenario adds field voles: small, slate-grey animals that live in the tall grass and boom and crash fast. They change two old habits.
          Culling foxes can free the voles to boom and strip the bushes, so rabbits starve instead of being eaten. And when voles crash, the foxes they fed
          turn to rabbits. Two extra interventions, Release voles and Vole illness, share the same four uses. The Open meadow has no voles.
        </p>
        <FoodWeb compact />
      </section>
      <section>
        <h3 className="mb-1 font-semibold">How the animals work</h3>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            Nobody tells them what to do. Each animal steers with a tiny brain whose weights are its genes. Founders are
            random, and successful hunters and foragers pass on their genes; mutation introduces new variation.
          </li>
          <li>
            Every hour costs energy: a base metabolism, vision upkeep, and a speed cost that grows with the square of
            speed. Sprinting drains the tank fast, and cruising lasts.
          </li>
          <li>Genes choose the pace every hour, so evolution trades bursts to flee or chase against endurance.</li>
          <li>
            Breeding needs adult age, the birth gap, and energy above the breed threshold. The parent pays child energy
            to each young.
          </li>
          <li>Animals die of old age at their lifespan. A dashed ring marks an animal close to starving.</li>
        </ul>
      </section>
      <section>
        <h3 className="mb-1 font-semibold">Setup, then run</h3>
        <p className="text-muted-foreground">
          Tune the levers within the budget, then release the animals. During the run you can intervene with rain,
          release animals, cull foxes, plant bushes, feed foxes or start species-specific illness, each followed by a cooldown. You have four uses shared across all eight options (ten in the Vole meadow); in Endless, one use comes back each season (see Keep a world). Illness spreads between nearby animals of the same species, adds an energy drain for ten days per case, and gives survivors temporary immunity. Purple rings mark illness. It can overshoot and cause extinction. The meadow pauses when a new red field note appears, so you have time to act; the switch beside the field notes turns this off.
        </p>
      </section>
      <section>
        <h3 className="mb-1 font-semibold">Score</h3>
        <p className="text-muted-foreground">
          One point per hour survived, up to 8,760 in the one-year challenge. A full year also earns 10 points for every budget point you did not
          spend (refunds only cancel spending), and a calm bonus of 400 for no interventions, 100 less for each one
          used. The daily meadow is the same for everyone today.
        </p>
      </section>
      <section>
        <h3 className="mb-1 font-semibold">Watch evolution</h3>
        <p className="text-muted-foreground">The Evolution page compares inherited responses in standard situations, with a band showing variation. Click an animal in the meadow to pause and inspect its family, energy and traits beside the interventions. The journal records generation, family and trait milestones, each with the measurement behind it and links to the animal, family or chart. Stronger hunters can still destabilise a meadow.</p>
      </section>
      <section>
        <h3 className="mb-1 font-semibold">Keep a world</h3>
        <p className="text-muted-foreground">Save meadow pauses and stores one world on this device, replacing your previous save. Resume restores its animals, food, genes and random state. The population graph and the journal are kept whole; replay covers the last 15 days before the save. In Endless mode, winters and droughts return each year; the fox invasion happens once. You start with four intervention uses; one comes back at the start of each season (1 Dec, 1 Mar, 1 Jun, 1 Sep), and you can hold at most four.</p>
      </section>
      <section>
        <h3 className="mb-1 font-semibold">Keys</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
          {KEYS.map(([k, v]) => (
            <div key={k} className="contents">
              <dt>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">{k}</kbd>
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
