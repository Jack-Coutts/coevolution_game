import { useAnimalIcons } from '@/components/world-view'
import type { Rules } from '@/sim/params'

const KEYS: [string, string][] = [
  ['Space', 'Play / pause'],
  ['← →', 'Back / forward one day (Shift: one hour)'],
  ['↑ ↓', 'Faster / slower'],
  ['Home End', 'Jump to start / live'],
  ['R', 'Reset the run'],
]

export function Guide({ rules }: { rules: Rules }) {
  const icons = useAnimalIcons()
  return (
    <div className="flex flex-col gap-4 text-sm leading-relaxed">
      <section>
        <h3 className="mb-1 font-semibold">Goal</h3>
        <p className="text-muted-foreground">
          Keep <b className="text-rabbit">rabbits</b> and <b className="text-fox">foxes</b> alive together from 1 September to
          the end of July (11 months 3 days). If either species dies out, the run ends.
        </p>
      </section>
      <section className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-lg border p-2">
          <img src={icons.rabbit} alt="" className="size-8" />
          <span className="text-xs text-muted-foreground">Rabbits graze the berry bushes. Bushes shrink as they are eaten.</span>
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
            random, and good hunters and foragers arise only through inheritance and mutation.
          </li>
          {rules === 'energy' ? (
            <>
              <li>
                Every hour costs energy: a base metabolism, vision upkeep, and a speed cost that grows with the square of
                speed. Sprinting drains the tank fast, and cruising lasts.
              </li>
              <li>Genes choose the pace every hour, so evolution trades bursts to flee or chase against endurance.</li>
              <li>
                Breeding needs adult age, the birth gap, and energy above the breed threshold. The parent pays child energy
                to each young.
              </li>
            </>
          ) : (
            <li>
              Classic benchmark rules: an animal starves after a fixed time without a meal and breeds after enough meals.
              These rules match the original benchmark exactly.
            </li>
          )}
          <li>Animals die of old age at their lifespan.</li>
        </ul>
      </section>
      <section>
        <h3 className="mb-1 font-semibold">Modes</h3>
        <p className="text-muted-foreground">
          <b className="text-foreground">Plan</b>: tune, press play, and watch. <b className="text-foreground">Live</b>: four
          interventions (rain, release or cull) with a cooldown. Best scores are kept separately for each mode.
        </p>
      </section>
      <section>
        <h3 className="mb-1 font-semibold">Score</h3>
        <p className="text-muted-foreground">
          One point per hour survived, up to 8,000. A full year adds 25 points for every unspent budget point. The daily
          seed is the same meadow for everyone today.
        </p>
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
