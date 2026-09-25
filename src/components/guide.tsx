import { useAnimalIcons } from '@/hooks/use-animal-icons'

const KEYS: [string, string][] = [
  ['Space', 'Play / pause'],
  ['← →', 'Back / forward one day (Shift: one hour)'],
  ['↑ ↓', 'Faster / slower'],
  ['Home End', 'Jump to start / live'],
  ['R', 'Reset the run (asks first once it has run a week)'],
]

export function Guide() {
  const icons = useAnimalIcons()
  return (
    <div className="gap-10 text-sm leading-relaxed lg:columns-2 [&>section]:mb-5 [&>section]:max-w-[70ch] [&>section]:break-inside-avoid">
      <section>
        <h3 className="mb-1 font-semibold">Goal</h3>
        <p className="text-muted-foreground">
          Keep <b className="text-rabbit">rabbits</b> and <b className="text-fox">foxes</b> alive together from 1
          September to the following September. Endless mode continues past the first year, until either species dies out.
        </p>
      </section>
      <section className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-lg border p-2">
          <img src={icons.rabbit} alt="" className="size-8" />
          <span className="text-xs text-muted-foreground">
            Rabbits graze the berry bushes. Bushes shrink as they are eaten.
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border p-2">
          <img src={icons.fox} alt="" className="size-8" />
          <span className="text-xs text-muted-foreground">Foxes hunt rabbits. A full fox stops hunting.</span>
        </div>
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
          release animals, cull foxes, plant bushes, feed foxes or start species-specific illness, each followed by a cooldown. You have four uses shared across all eight options. Illness spreads between nearby animals of the same species, adds an energy drain for ten days per case, and gives survivors temporary immunity. Purple rings mark illness. It can overshoot and cause extinction. The meadow pauses when a new red field note appears, so you have time to act; the switch beside the field notes turns this off.
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
        <p className="text-muted-foreground">The Evolution page compares inherited responses in standard situations, with a band showing variation. Click an animal in the meadow to pause and inspect its family, energy and traits beside the interventions. The journal records generation and lineage milestones. Stronger hunters can still destabilise a meadow.</p>
      </section>
      <section>
        <h3 className="mb-1 font-semibold">Keep a world</h3>
        <p className="text-muted-foreground">Save meadow pauses and stores one world on this device, replacing your previous save. Resume restores its animals, food, genes and random state. The population graph and the journal are kept whole; replay covers the last 15 days before the save. In Endless mode, winters and droughts return each year; the fox invasion happens once. The four intervention charges last the whole run.</p>
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
