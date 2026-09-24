# Coevolution: Meadow Keeper (game design)

A browser game about an evolving predator and prey ecosystem, in the `coevolution_game` repo.

## Core loop

1. **Plan.** Pick a scenario and seed. Adjust levers within a point budget. Readouts show what
   the levers imply:
   - How long an animal lasts on a full tank when resting, cruising or sprinting.
   - The birth gap once litter size is included.
   - The breeding and child energy.
   - The berries regrown per day.
2. **Run.** Press play. Rabbits graze berry bushes and foxes hunt rabbits. Both species
   evolve their steering and their pace. The run ends when either species dies out, or after
   8,000 hours.
3. **Debrief.** You get a score, stars, and a plain-language cause, for example:
   "Foxes starved on 27 Sep (day 26). There were too few rabbits to live on (about 20 over the
   last 12 days)." It comes with 2 or 3 lever suggestions. Then you retune and retry.

You win only when **both** species are alive at the horizon.

## Time (what players see)

Ticks stay internal. The simulation, the tests and the stored data all use ticks. The
UI shows natural time only.

- **Clock.** 1 tick is 1 hour. A run starts on 1 September at 08:00. The 8,000-hour horizon
  ends on 31 July at 16:00, which is "11 months 3 days", counting a month as 30 days for
  durations.
- **What is shown in natural time.**
  - A clock with the date, the day of the run and the season.
  - A day and night cycle, with dusk tints. It fades at 3 d/s and above to avoid flicker.
  - The timeline axis, in months.
  - Ages, gaps and lifespans in days and hours, costs "per hour", and regrowth as "every N h".
  - Playback speeds: 12 h/s, 1 d/s, 3 d/s, 1 wk/s (the default), 2 wk/s and 1 mo/s.
- **Seasons.** Autumn is September to November, winter December to February, spring March to
  May and summer June to July.
  - Seasons tint the scenery: amber in autumn, frost in winter, dry grass in summer.
  - Only the scenarios change the rules, and they are aligned to the calendar.

## Rules

Every animal takes exactly one step per tick, with its step length capped by its max speed.
There are no sub-steps and no fewer, larger steps. Animals steer with an evolved controller
whose weights are their genes. Founders are random, and children inherit with mutation.

**Energy rules**

- Each animal has energy, capped at a maximum. It dies of old age, or when its energy reaches
  0.
- Each tick it pays `metabolism + vision upkeep × view range + speed cost × (step / standard step)²`.
  A sprint at full standard speed costs 4 times the movement energy of a cruise at half
  speed.
- Pace is chosen every tick by the genes, for both species, from standing still up to max
  speed.
- Food:
  - A rabbit eats one berry unit per tick when it is at a stocked bush and not full. Each
    berry gives it the energy per berry.
  - A fox kills a rabbit in reach when it is not full, and gains the energy per rabbit.
- Breeding needs adult age, the birth gap since the parent's last birth, and energy at or
  above the breed threshold.
  - The parent pays the child energy for each young, and that energy seeds the young.
  - A litter of L young lengthens the gap by a factor of `1 + 0.5 (L − 1)`.
- Founders start with 75% energy.
- Scenario and intervention randomness uses a separate RNG, so a disturbance never shifts
  the animals' random stream before it starts.

## Levers

| Group | Levers (each species separately where it applies) |
| --- | --- |
| Populations | Starting rabbits and foxes, rabbit cap, fox cap |
| Life cycle | First-birth age, birth gap, litter size, lifespan, breed threshold, child energy |
| Energy | Max energy, metabolism, speed cost, energy per berry or per rabbit |
| Senses and movement | Max speed (0.6 to 1.5 times the standard), sense range, turning |
| Food | Bush count, berries per bush, regrowth interval |
| Evolution | Mutation rate |

**Trade-offs, so maxing everything loses**

- **Budget.** You have 30 points, counted from the scenario's starting levers.
  - Moving a lever in its "stronger" direction costs points: more food, longer life, faster,
    larger tank, cheaper upkeep, and so on.
  - Moving it the other way refunds half.
  - Child energy and mutation rate are free.
  - Maxing every lever costs more than 150 points.
- **Built-in costs.**
  - The quadratic speed cost.
  - Vision upkeep.
  - A larger tank raises the breed threshold and the child cost in absolute terms.
  - Litters lengthen the gap and cost energy for each young.
- **Ecology.**
  - Strong foxes eat out the rabbits and then starve.
  - Rich food lets rabbits hit the cap and strip the bushes.

## Stable preset ("Stable meadow")

The preset came from an offline sweep under the energy rules (`scripts/sweep.ts`):

- A random search of 600 configurations on held-out seeds 100 to 109.
- The 37 configurations that survived 9 or 10 of those seeds were ranked on stable-meadow
  survival and scenario sensitivity over seeds 100 to 119.
- The pick survives the stable meadow, but each scenario visibly knocks it off balance.

Seeds 0 to 9 were used only for reporting.

| Scenario | Seeds 0–9 | Held-out seeds 100–119 |
| --- | --- | --- |
| Stable meadow | **10/10** to 8,000 | 20/20 (47/50 on seeds 100–149) |
| Drought | 7/10 | 9/20 |
| Fox invasion | 7/10 | 8/20 |
| Harsh winter | 6/10 | 3/20 |

The preset's values:

- **Rabbits:** 100 at the start, cap 190, first birth at 60 h, gap 130 h, lifespan 840 h,
  max energy 180, metabolism 0.35/h, speed cost 0.50, 55 energy per berry, breed at 65%,
  child 45%, speed 1.15×.
- **Foxes:** 9 at the start, cap 12, first birth at 130 h, gap 200 h, lifespan 820 h, max
  energy 240, metabolism 0.35/h, speed cost 0.95, 90 energy per rabbit, breed at 75%, child
  40%, speed 0.95×, sense 1.3×.
- **Food:** 19 bushes of 30 berries, regrowing one berry every 9 h.
- **Mutation:** 10%.

The equilibrium is food-limited. The bushes sit near bare, and the fox cap holds the hunting
pressure.

**Can each scenario be rescued within budget?** A budget-constrained climb on seeds 100 to
109 checked this:

| Scenario | Before | After | Points used |
| --- | --- | --- | --- |
| Drought | 5/10 | 7/10 | 2 |
| Fox invasion | 4/10 | 10/10 | 0.5 |
| Harsh winter | 2/10 | 7/10 | 10.5 |

## Modes

- **Plan.** Set the levers, then watch. There are no interventions.
- **Live.** The same run, plus 4 interventions with a shared 400-hour cooldown. They work only
  when you are watching live, not while you replay the past.
  - Rain: refill every bush.
  - Release rabbits: +8 near the bushes, cloned with mutation from living rabbits.
  - Cull foxes: remove a third of them.
  - Release foxes: +3 at the edge.

Levers lock while a run is going. Reset to retune.

## Scenarios

| Scenario | Disturbance |
| --- | --- |
| Stable meadow | none |
| Drought | From 1 May to the end, regrowth runs at 35% |
| Fox invasion | On 1 November, 14 fed foxes (clones of living ones) arrive at the edge, and the fox cap rises by 14 |
| Harsh winter | From 1 December to 28 February, regrowth runs at 30% and metabolism rises by 35%, with a heavy snow tint |

- **Daily seed.** The date as `YYYYMMDD` gives the same meadow for everyone that day.
- **Other seeds.** A dice button gives a random custom seed.

## Scoring

- **Score** = hours survived. A full year also earns +25 for each unspent budget point, and
  refunded points count.
- **Stars** at 3 months, 7 months and the full year.
- The best score is kept in `localStorage` for each ruleset, scenario, seed and mode.

## Feedback

- **Timeline.**
  - It plots rabbits (left scale), foxes (right scale) and the berry stock as an area.
  - It shades scenario spans and marks events and interventions.
  - A dashed 300-hour forecast extends the log-linear trend of the last 10 days.
  - A hover readout shows the values at any point. Click or drag it to replay any earlier
    moment.
- **Field notes.** Hints ranked by risk:
  - Warnings: a rabbit boom while bushes run low, fewer than 5 rabbits per fox while rabbits
    fall, hungry foxes or rabbits, a fox boom (a bust follows), a forecast extinction date,
    and very few animals left.
  - Information: bare bushes, and a species at its cap.
- **Failure explanations.** They use the causes of death over the final 300 hours, the average
  density, how far rabbits are from bushes, the bush stock, the last birth, and the active
  scenario span. For example:
  - Foxes starved: rabbits too scarce, too spread out, or too hard to catch.
  - Foxes aged out, with no cubs since a given date.
  - Rabbits eaten out, with the fox-to-rabbit ratio.
  - Rabbits starved: bushes grazed bare.
  - Rabbits aged out.

## Tech

- **Stack.** Vite, TypeScript and Canvas 2D for the world, with sprites pre-rendered to
  offscreen canvases. React, Tailwind and shadcn/ui for the panels.
- **Simulation.** `src/sim/` holds pure TypeScript with no DOM. It runs in a Web Worker.
  - The main thread owns the display clock and asks the worker to stay about 0.25 s ahead.
  - The worker streams a frame and a stats row every tick.
  - The history keeps every tick for the last 360 hours and a keyframe every 3 hours for
    scrubbing.
  - The renderer interpolates by animal id.
- **Rendering.**
  - Top-down rabbits (grey-brown, laid-back ears, white scut) and foxes (rust, black ear
    backs and legs, bushy white-tipped tail), rotated to heading, with a 6-frame gait whose
    speed follows each animal's pace.
  - Young animals are drawn smaller, and animals close to starving get a dashed ring.
  - The meadow is calm and procedural: grass tufts, wildflower drifts, rocks, and grazed
    earth under the bushes.
  - Bushes shrink with their stock and show berries in proportion to it.
- **Tests.** Vitest:
  - The RNG, reproducibility, starvation and births.
  - Time labels, the lever grid and budget, and the litter cost.
  - Energy rules: determinism, at most one capped step per tick, the quadratic cost, and
    scenario RNG isolation.
  - A regression test that the stable preset survives at least 7 of seeds 0 to 9.
