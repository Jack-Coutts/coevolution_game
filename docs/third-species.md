# Third species: the field vole

Design record for [#7](https://github.com/Jack-Coutts/coevolution_game/issues/7), part of the
roadmap in [#2](https://github.com/Jack-Coutts/coevolution_game/issues/2). It feeds the
simulation work in [#8](https://github.com/Jack-Coutts/coevolution_game/issues/8) and the
playable scenario in [#9](https://github.com/Jack-Coutts/coevolution_game/issues/9).

**Decision.** The third species is the **field vole**: a small, fast-breeding plant eater that
lives in the tall grass, eats its seed heads, raids the berry bushes when the grass runs out,
and is a small meal for foxes. It is alternative prey that competes with rabbits for food
and shares their predator. It arrives in a new, separate scenario. The two-species
**Open meadow** stays the default introduction, and practice meadow seed 5007 is unchanged.

Every number in this record marked *provisional* is a starting point for #8 and #9, not a
tuned value. Prototype results come from a throwaway engine hack and are labelled as such.

## Contents

1. [What the third species has to achieve](#1-what-the-third-species-has-to-achieve)
2. [Roles compared](#2-roles-compared)
3. [Prototype evidence](#3-prototype-evidence)
4. [The field vole's place in the food web](#4-the-field-voles-place-in-the-food-web)
5. [Provisional starting parameters](#5-provisional-starting-parameters)
6. [Visible identity](#6-visible-identity)
7. [How players learn the vole's role](#7-how-players-learn-the-voles-role)
8. [Decisions the vole changes](#8-decisions-the-vole-changes)
9. [Interventions](#9-interventions)
10. [Win and extinction rules](#10-win-and-extinction-rules)
11. [Scenarios and the two-species meadow](#11-scenarios-and-the-two-species-meadow)
12. [Saves and compatibility](#12-saves-and-compatibility)
13. [Bounded first implementation](#13-bounded-first-implementation)
14. [Checks for the simulation issue (#8)](#14-checks-for-the-simulation-issue-8)
15. [Checks for the playable-scenario issue (#9)](#15-checks-for-the-playable-scenario-issue-9)
16. [Open questions and defaults](#16-open-questions-and-defaults)
17. [Appendix A: two-species assumptions in the code](#appendix-a-two-species-assumptions-in-the-code)
18. [Appendix B: reproducing the prototype](#appendix-b-reproducing-the-prototype)

## 1. What the third species has to achieve

The roadmap gate is that a third species creates new, understandable player decisions and
does not merely add more animals. So the species must:

- add a relationship the meadow does not have today, not a second copy of an existing role;
- change what a sensible player does in at least two situations, with signals they can see;
- be teachable in a sentence or two, using sprites, labels and notes the game already has;
- fit the existing rules: one hour per tick, 365-day challenge, four shared intervention
  uses with a 400-hour cooldown, population ceilings as technical safeguards only;
- leave the two-species meadow, its seeds and its saves exactly as they are.

Survival is a calibration guide, not the goal. The base meadow aims for roughly 30 to 50%
untouched survival so that intervention matters. The same guide applies to the new scenario.

## 2. Roles compared

Four roles were considered. "Engine cost" is measured against the current code, which is
already partly species-generic (`SpeciesDef.eats`, sense categories of threat, food and kin).

| Role | Example | Eats / eaten by | New relationship | New player decisions | Teaching cost | Engine cost | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Alternative prey that competes for plants** | Field vole | Grass seed and berries / foxes | Competition with rabbits for food; apparent competition through a shared predator | Culling foxes can unleash a vole plague; a vole crash turns foxes onto rabbits; rain feeds voles as well | Low: "small, breeds fast, lives in tall grass, foxes eat it" | Low to medium: generic food and meal value per victim, one new food source (grass seed) | **Chosen** |
| Second predator of rabbits | Buzzard or owl | Rabbits / nothing | Competition between predators for one prey | Which predator to cull or feed; tall grass matters more | Medium: two hunters to tell apart, flying sprite | Medium: per-hunter cover sight, flight ignores grass | Rejected, see prototype |
| Omnivore (intraguild) | Badger | Berries and rabbits / nothing | Eats both the plants and the plant eaters | Feeding one level feeds the omnivore too | High: two diets to explain | High: brains see one food channel; mixed diets need a new sense layout, so a genome change | Rejected for the first species |
| Apex predator | Eagle | Foxes / nothing | A fourth trophic level | Protect foxes from their own predator | Medium | Low | Rejected: tens of foxes cannot feed a lasting population; it would go extinct by chance, not by decision |

Why the omnivore and apex roles were not prototyped: the omnivore needs a brain input change
(one set of food senses today), which would break the linear-controller evidence in
`docs/validation.md`; the apex role fails on arithmetic before any simulation, since the
base meadow averages about 30 to 40 foxes.

## 3. Prototype evidence

These are **prototype numbers** from a throwaway branch, `third-species-prototype`, which
will never be merged. They show which forks behave well enough to design around. They are
not balance claims for the finished game.

### Method

- The base world is the current Open meadow preset (`STABLE_PRESET`), unchanged.
- The hack adds one optional species behind prototype-only parameters. With the option off,
  the engine draws the same random numbers as before (the third species is placed and
  spawned after rabbits and foxes).
- Parameters were tuned on **exploratory seeds 8000 to 8009** only, then frozen.
- Final comparison on **fresh seeds 9000 to 9019**, never used for tuning, run one process
  at a time for fair timing. Node 22.22.2 on Linux x64 (a cloud container; absolute
  timings will differ on other machines, ratios are the useful part).
- For measurement only, the run continues after an extinction so each species' first
  extinction hour is known. Rabbit and fox outcomes before the first extinction are
  identical to the game rules.

Four batches were compared:

- **base**: today's two-species meadow.
- **vole**: the chosen design. Voles eat tall-grass seed (their own food) and berries at a
  quarter of a rabbit's value; foxes gain 40% of a rabbit meal from a vole.
- **naive vole**: the same vole but eating only berries, at full value. This is "alternative
  prey that competes for plants" in its simplest form.
- **hawk**: a second predator of rabbits that flies (not slowed by tall grass) and cannot
  see rabbits hiding in it.

### Results

Fresh seeds 9000 to 9019, 20 seeds per batch, no interventions. "Third" is the added
species (voles or hawks). Survival intervals are Wilson 95%.

| Batch | All species alive at a year | Rabbits and foxes alive at a year | Runs where the third species died out | First species lost (rabbit / fox / third / none) | Mean rabbits | Mean foxes | Mean third | Rabbits eaten per run | Third eaten per run | Peak rabbits / foxes / third | Ceiling-hit runs | Median ms per simulated year |
| --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| Base (two species) | 9/20 (26 to 66%) | 9/20 | n/a | 9 / 2 / n/a / 9 | 143 | 36 | n/a | 1,659 | n/a | 789 / 194 / n/a | 0 | 6,606 |
| **Vole (chosen design)** | **4/20 (8 to 42%)** | 7/20 | 8 | 8 / 2 / 6 / 4 | 108 | 39 | 82 | 1,270 | 1,571 | 656 / 187 / 335 | 0 | 9,904 |
| Naive vole (berries only) | 0/20 (0 to 16%) | 5/20 | 14 | 3 / 3 / 14 / 0 | 100 | 23 | 65 | 1,077 | 125 | 595 / 217 / 800 | 2 | 10,248 |
| Hawk (second predator) | 2/20 (3 to 30%) | 4/20 | 15 | 8 / 3 / 7 / 2 | 152 | 25 | 15 | 1,664 | 0 | 713 / 160 / 120 | 1 | 7,464 |

Mean populations are averaged over every simulated hour of each run, then over runs. Timing
is measured only over hours when every species in the batch was alive.

Per-seed survival (Y = all species alive at a year, seeds 9000 to 9019 left to right):

```text
Base        .Y...Y.Y.Y.Y.Y..YYY.
Vole        .Y....Y..Y......Y...
Naive vole  ....................
Hawk        ....Y......Y........
```

Paired against the same seed in the base meadow:

| Batch | Mean foxes higher than base | Median change in mean foxes | Mean rabbits lower than base | Median change in mean rabbits | Median time per simulated year versus base |
| --- | ---: | ---: | ---: | ---: | ---: |
| Vole | 12/20 seeds | +6 | 14/20 seeds | -22 | 1.54 times |
| Naive vole | 6/20 seeds | -8 | 15/20 seeds | -37 | 1.47 times |
| Hawk | 4/20 seeds | -4 | 10/20 seeds | +2 | 1.14 times |

Other measurements from the vole batch:

- Voles took 38% of their bites from berry bushes (203,746 berry bites against 333,398 seed
  bites over the 20 runs), so competition with rabbits for berries is real, not nominal.
- Foxes ate more voles (1,571 per run) than rabbits (1,270 per run, against 1,659 in the
  base meadow). Voles take predation off rabbits while they are plentiful.
- Voles boom and starve: across the batch, 81% of vole deaths were starvation (150,194),
  17% predation (31,414) and 2% old age (4,332). Peaks stayed between 217 and 335, far
  under the 800 safeguard.
- Voles died out in 8 runs, at hours 2,060 to 7,340; in 2 of those they were not the first
  species lost.

Two-species regression: with the option off, the prototype engine gave the same result as
unmodified `main` on every row of `validate-balance.ts 5000 50` in this runtime (tick, final
counts, peaks, ceiling hits and every death counter). Both gave **19/50** here. The 18/50 in
`docs/validation.md` was recorded with Node 25.2.1 on macOS arm64. This runtime is Node
22.22.2 on Linux x64, and the validation record already warns that trajectories differ between
runtimes. The regression check in section 14 therefore compares against `main` in the same
runtime, not against a fixed count.

### What the prototype showed

1. **Two predators on one prey collapse to one predator.** Hawks died out in 15 of 20 runs,
   averaged 15 birds, and left fewer foxes than the base meadow in 13 of 20 seeds (3 equal).
   Rabbits and foxes together survived the year in only 4 of 20 seeds, against 9 in the base
   meadow. The hawk made the
   existing game worse and then vanished, which gives the player a species to watch fail,
   not a decision. A different hawk might do better, but competition between two predators
   for a single prey is the structural cause. **Rejected.**
2. **Alternative prey that only eats berries does not coexist.** The naive vole died out
   first in 14 of 20 runs, usually within the first two months, and in 2 runs boomed to the
   800 safeguard. With one shared food, the faster breeder overshoots and starves, or it
   starves the rabbits. **Rejected in this form.**
3. **Alternative prey with a food of its own does coexist, and changes the web.** Giving
   voles tall-grass seed as their main food (and berries as a poor fallback) kept voles alive
   in 12 of 20 runs, fed foxes (more foxes in 12 of 20 seeds), lowered rabbits (14 of 20
   seeds) through berry competition, and moved most fox kills onto voles. This is the
   apparent competition and buffering the design needs. **Chosen.**
4. **Untouched survival is too low for now.** All three species survived a year in 4 of 20
   fresh seeds (20%, interval 8 to 42%), below the 30 to 50% guide. No one species dominates
   the failures (rabbits first in 8, voles in 6, foxes in 2), which is a good starting point
   for tuning, but #9 must tune before calling the scenario balanced.
5. **Cost.** The vole meadow took about 1.5 times as long per simulated year as the base
   meadow, from more animals and an unoptimised seed search. #8 has a performance budget in
   section 14.

### Limits

- Twenty seeds per batch; the survival figures carry wide intervals (Wilson 95% shown).
- No interventions were exercised. The decision situations in section 8 are hypotheses that
  #9 must test with scripted policies.
- Timing is Node on one machine, sequential, measured only while every species in the batch
  is alive. The browser worker also packs frames and statistics, which the prototype does
  not include.
- The hawk and vole were each given only a few tuning rounds. A better hawk may exist, but
  the failure mode (one predator excluding the other) is structural, not a tuning accident.

## 4. The field vole's place in the food web

| | Rabbit | **Field vole** | Fox |
| --- | --- | --- | --- |
| Eats | Berries | **Seed heads in tall grass; berries when seed is short** | Rabbits and voles |
| Eaten by | Foxes | **Foxes** | Nothing |
| Competes with | Voles, for berries | **Rabbits, for berries** | Nothing new |
| Lives | Everywhere, hides in tall grass | **Mostly in tall grass** | Everywhere |

In words:

- **Food of its own.** Each tall-grass patch carries a seed stock that regrows. Only voles
  eat it. This is what lets voles and rabbits coexist: in the prototype, voles that ate only
  berries either wiped out the rabbits or starved themselves out.
- **Competition.** When the seed runs short, voles move to the berry bushes. A vole gets
  little from a berry, but many voles still strip a bush. Rabbits feel this as bare bushes.
- **Apparent competition.** Voles feed foxes. Many voles means well-fed foxes and more fox
  kits. When voles crash, those foxes turn to rabbits.
- **Refuge.** Tall grass hides voles from foxes just as it hides rabbits, and voles are not
  slowed in it. Foxes catch voles mostly on open ground, on the way to and from bushes.

Distinguishing trade-offs:

| Trait | Rabbit (Open meadow) | Vole (provisional) | Effect |
| --- | --- | --- | --- |
| Energy tank | 180 | 60 | Voles starve fast when food fails |
| First birth | 50 h | 40 h | Voles boom quickly |
| Litter | 2 | 3 | Booms are steep |
| Lifespan | 840 h | 480 h | Voles turn over fast; old age rarely matters |
| Energy per berry | 55 | About 9 (3.5 per bite of 0.4 berry) | Poor at berries |
| Energy from grass seed | none | 14 per bite of 0.4 seed (35 per seed) | Good at grass seed |
| Value to a fox | 90 | 36 (40% of a fox meal) | A small snack: foxes stay hungry and keep hunting |
| Movement in tall grass | slowed to 75% | full speed | Lives in the grass |

## 5. Provisional starting parameters

All values are **provisional**. They are the frozen prototype values, written in the shape of
`SpeciesParams` (`src/sim/params.ts`). #8 implements them; #9 tunes them.

### Vole body (`SpeciesParams`)

| Field | Value | Note |
| --- | ---: | --- |
| `initial` | 60 | Founders placed after rabbits and foxes |
| `adultAge` | 40 | Hours to first breeding |
| `birthGap` | 96 | Effective gap for a litter of 3, in hours. If this becomes a lever, the lever value is 48 because `litterGap` multiplies it by 2 for a litter of 3; the current lever minimum of 60 would need to drop |
| `litter` | 3 | |
| `lifespan` | 480 | |
| `maxEnergy` | 60 | |
| `metabolism` | 0.22 | Energy per hour |
| `speedCost` | 0.3 | At `baseStep` |
| `mealEnergy` | 14 | Per seed bite; berry bites use the berry value below |
| `breedEnergy` | 0.6 | Share of max energy |
| `childEnergy` | 0.2 | Share of max energy per young |
| `visionUpkeep` | 0.15 | |
| `step` / `baseStep` | 0.009 | Slightly slower than a rabbit's 0.0125 |
| `view` | [0.12, 0.12] | Short sight |
| `turn` | [1.2, 1.2] | Nimble |

### New ecology values

| Value | Provisional | Where it would live |
| --- | ---: | --- |
| Bite size (berry or seed units per bite) | 0.4 | Species definition |
| Berry energy multiplier for voles | 0.25 | Species definition |
| Seed stock per tall-grass patch | 20 | World parameter |
| Seed regrowth | +1 per patch every 6 h, scaled by the scenario regrowth factor (drought, winter) | World parameter |
| Fox meal value of a vole | 0.4 of the fox's `mealEnergy` | Species definition of the victim |
| Voles slowed by tall grass | no | Species definition |
| Foxes see a vole in tall grass within | `coverSight` (0.04), as for rabbits | Unchanged |
| Vole population ceiling | 800 | `EcoParams`, a technical safeguard |

Tuning note for #9: prototype voles bred far beyond what the seed could feed (81% of vole
deaths were starvation, section 3). Try a litter of 2, a higher breed threshold, or more seed
per patch first. Keep the vole a fast breeder with a small tank; that contrast with the rabbit
is the point of the species.

The first implementation changes nothing for rabbits and foxes. The fox meal value of a
rabbit stays 1.0, so the Open meadow is bit-for-bit unchanged.

## 6. Visible identity

- **Name.** "Field vole" in the guide, "voles" everywhere else. Internal key `vole`
  (see section 12 for why `prey` and `pred` stay as they are).
- **Silhouette.** Seen from above like the other sprites: a rounded, almost egg-shaped body,
  blunt nose, tiny round ears barely past the head, and a short thin tail. No long ears (the
  rabbit's mark) and no bushy tail (the fox's).
- **Size.** Body length about 0.022 of the meadow, two thirds of a rabbit (0.033) and under
  half a fox (0.052).
- **Coat.** Cool slate grey-brown, provisional `#6b6a70` body with a darker back stripe
  `#4d4b52`. It is darker than the pale green meadow (`#8cb160`), and cooler than the rabbit's
  warm agouti, so it does not read as a small rabbit.
- **UI colour token.** `--color-vole`, a soft slate blue. Blue is the one hue the meadow does
  not already use (rabbit sand, fox orange, berry green, illness violet). Provisional values:
  `#9fb3cc` on the dark UI the game ships with, and `#3d5a7a` if a light theme is used. Both
  must be checked for contrast and colour-blind separation from the rabbit and fox lines in
  #9 before they are final.
- **Grass seed.** Tall-grass patches show seed heads that thin out as the stock falls, so
  players can see vole food running out, like bushes shrinking today.
- **Markers.** Vole births and deaths are very frequent (in the prototype, thousands per run),
  so they get no always-on marker, and birth and starvation effects are skipped at fast
  playback, as the renderer already does for rabbits. Vole deaths to foxes use the existing
  "eaten" effect. The deaths table should show vole numbers in their own row so they do not
  swamp the rabbit and fox rows.

## 7. How players learn the vole's role

Players learn in the order they meet the vole:

1. **Scenario card.** "Vole meadow: field voles live in the tall grass and eat its seeds.
   Foxes eat them too. Keep rabbits, voles and foxes alive for a year."
2. **Guide.** A third row next to the rabbit and fox rows, with the vole icon: "Voles eat grass
   seed, and berries when seed runs short. Foxes eat voles, but a vole is a small meal."
   The guide's win rule says all three species must survive in the Vole meadow.
3. **First-appearance note.** The first time a player starts the Vole meadow, a dismissible
   field note explains the two links that matter: "Voles compete with rabbits for berries"
   and "Voles feed foxes. When voles crash, foxes turn to rabbits." Stored per device.
4. **Field notes (hints).** New vole hints use the existing tone system, with the signals in
   section 8: seed running out, vole plague, vole crash with many foxes, few voles left.
5. **Death table and inspector.** A vole row in the deaths-by-cause table; inspecting a vole
   shows the same fields as a rabbit. The Evolution tab gains a vole option.
6. **End-of-run explanation.** If voles die out, the explanation names the cause (starved,
   eaten, illness) the same way it does for rabbits today.

## 8. Decisions the vole changes

Each situation names the signals a player sees and the decision that differs from the
two-species meadow. These are design hypotheses; #9 must test each with a scripted policy on
paired seeds (section 15).

### Situation 1: rabbits are being eaten out, and voles are abundant

- **Signals.** Rabbits falling; the existing "only N rabbits per fox" warning; the vole count
  high and rising; tall-grass seed heads thin.
- **Two-species habit.** Cull foxes. It is the direct fix.
- **With voles.** Foxes are what hold voles down. Culling a third of the foxes can release a
  vole plague that strips the bushes, and the rabbits then starve instead of being eaten.
  Better options may be to release rabbits, plant bushes, or start fox illness (slower, so the
  vole boom is less sudden), or to cull and then plant. The decision is now a trade-off
  between predation and competition.

### Situation 2: voles are crashing and foxes are many

- **Signals.** Vole count down steeply over ten days; fox energy still high; many fox kits in
  the last ten days (the existing kits readout); grass seed bare.
- **Two-species habit.** Nothing looks wrong for rabbits yet, so wait.
- **With voles.** The fox population was built on voles. As the voles disappear, those foxes
  turn to rabbits. The warning comes before rabbits start falling: a well-timed fox cull, or
  rain so rabbits breed ahead of the switch, prevents a collapse that the two-species signals
  do not yet show. New hint: "Voles are crashing and N foxes will turn to rabbits."

### Situation 3: bushes are bare and rabbits are hungry

- **Signals.** Bushes nearly bare; rabbits underfed; grass seed also low, so voles are at the
  bushes.
- **Two-species habit.** Rain refills every bush at once.
- **With voles.** Rain feeds voles too, and a vole boom can follow. Planting adds lasting food
  but voles share it. Waiting for foxes to thin the voles, or releasing rabbits near food, are
  now real alternatives. When grass seed is plentiful, voles stay in the grass and rain
  behaves as before, so the player has to read the seed heads first.

### Situation 4 (optional): voles are nearly gone

- **Signals.** "Only N voles left" (a new danger hint); grass seed full.
- **Decision.** Release voles (new) against the rest of the budget, or accept the risk. Voles
  recover fast from a few survivors, which is itself something players learn.

## 9. Interventions

The budget stays as it is: **four uses shared across all options, 400 hours between uses,
for the whole run**. #4 is balancing the current eight actions first; vole changes should
build on its result.

| Action | In the Vole meadow | Change |
| --- | --- | --- |
| Rain | Refills bushes only, not grass seed | Unchanged mechanically; blurb adds that voles eat berries too |
| Plant bushes | As now | Unchanged |
| Release rabbits | As now | Unchanged |
| Release foxes | As now | Unchanged |
| Cull foxes | As now | Unchanged; the Vole meadow's hints warn about vole plagues |
| Feed foxes | As now | Unchanged |
| Rabbit illness | As now; illness does not cross species | Unchanged |
| Fox illness | As now | Unchanged |
| **Release voles** | Twelve voles, descended from living voles, placed in tall grass | New, Vole meadow only |
| **Vole illness** | Same process as the other illnesses, within voles only | New, Vole meadow only |

Ten options in the Vole meadow; the Open meadow keeps its eight. No action removes voles
directly: a "cull voles" button would turn the vole into a pest to delete rather than a
population to manage. A "mow tall grass" action (cuts vole food and rabbit cover at once) is
an interesting later candidate, not part of the first implementation.

In the code, the new actions extend the `Intervention` union (`releaseVole`,
`illnessVole`). The run panel should show only actions whose species is present.

## 10. Win and extinction rules

- **Challenge (365 days).** The Vole meadow is won only if **rabbits, voles and foxes are all
  alive** at the end of the year.
- **Run end.** The run ends at the **first extinction of any of the three species**, as the
  two-species game ends at the first extinction today. This keeps one rule for every meadow:
  "keep every species alive".
- **Endless.** Same rule: it continues until any species disappears.
- **Score.** Unchanged formula (hours survived, plus unspent-budget and calm bonuses on a full
  year). The best-score key already includes the scenario id, so Vole meadow scores are kept
  separate automatically.
- **Explanation.** The end-of-run explanation names the species that died out and its causes.
  The three-species case needs a vole branch, plus fox starvation that names voles when voles
  were the fox's main food in the final window.

Why not make voles optional? If losing the voles did not end the run, the cheapest strategy is
to ignore them, and situations 1, 2 and 4 stop being decisions. In the prototype, first
extinctions were spread across species (rabbits 8, voles 6, foxes 2 of 20 seeds), so the
rule does not hinge on one fragile species. Voles also recover quickly from a release, which
gives the player a real rescue option.

## 11. Scenarios and the two-species meadow

- **Open meadow stays the default** and the introduction. It keeps rabbits and foxes only,
  the same preset, the same eight actions, and the same balance evidence (18 of 50 seeds
  5000 to 5049 in the recorded Node runtime, see `docs/validation.md`).
- **Practice meadow seed 5007 is unchanged** and still opens the Open meadow.
- **New scenario: "Vole meadow"** (id `voles`), listed after the existing four. It uses the
  Open meadow preset for rabbits, foxes and plants, adds voles and grass seed, and has no
  weather disturbance, so the new species is the only new thing.
- **Drought, Harsh winter and Fox invasion stay two-species** in the first implementation.
  Combining them with voles is a later step, after the Vole meadow is calibrated.
- **Hidden until #9.** #8 adds the scenario to the simulation and tests but keeps it out of the
  scenario picker; #9 makes it visible.
- **Comparison.** Because rabbits, foxes and plants use the same preset in both meadows,
  players and tests can compare the same seed with and without voles.

The species set belongs to the scenario, not to the levers. `Scenario` gains a field such as
`species: ['prey', 'pred', 'vole']`, and the Open meadow's is `['prey', 'pred']`.

### Levers in the Vole meadow

The 30-point budget is unchanged. The first implementation adds only **Starting voles** to
the Populations group. The existing **Tall grass** lever now does two things at once (more
rabbit cover and more vole food), which is itself a planning trade-off. The vole body is fixed
in the first implementation; full vole life-cycle levers would add 13 sliders and are left
out.

## 12. Saves and compatibility

Existing saves are version 2 (`MeadowSave.version` and `Sim.save().version`) and hold a
two-species world. They must keep working.

- **Keep the internal keys `prey` and `pred`.** They are in save files, lever ids
  (`prey.litter`), statistics names and the stats row. Renaming them would break every save
  and score for no player-visible gain. The third species gets its own key, `vole`.
- **Bump both versions to 3.** A version 3 state records its species list.
- **Migrate version 2 on load**, in memory: species list `['prey', 'pred']`, empty vole
  population, founders and grids, no grass seed, zeroed vole counters. The world then
  continues exactly as it would have in the old engine. Save back as version 3.
- **History.** Append vole statistics to the end of the stats row so the first 23 columns keep
  their meaning; a migrated row fills the new columns with zeros. The migrated history is
  labelled as a two-species meadow and shows no vole line.
- **If migration fails** (a corrupt or unknown save), show the existing clear message, "This
  save belongs to another game version.", and offer a fresh meadow. Never load a partial world.
- **Scores.** Best scores stay keyed by scenario, seed and mode. Open meadow bests remain
  valid because the Open meadow is unchanged.

## 13. Bounded first implementation

In scope for #8 and #9:

- One new species, the field vole, with the food web in section 4.
- Grass seed as vole food in existing tall-grass patches.
- A per-victim meal value and a per-species bite and berry value in the species definition.
- The Vole meadow scenario, the win rule in section 10, and the two new actions.
- Vole levels in statistics, history, events, frames, saves, hints, explanations, the death
  table, the inspector, the Evolution tab, the timeline and the guide.

Out of scope:

- A general species editor, or any promise of a fourth species. The code should be generic
  where that is cheaper (species lists instead of `prey`/`pred` pairs), but no UI for adding
  species.
- New brain inputs. Voles use the same 25 senses; grass seed appears in the food senses.
- Vole life-cycle levers, weather scenarios with voles, mowing, spontaneous disease.
- Retuning the Open meadow.

## 14. Checks for the simulation issue (#8)

| Check | How to measure | Pass |
| --- | --- | --- |
| Two-species regression | `node --import tsx scripts/validate-balance.ts 5000 50` on the #8 branch and on `main`, same machine and Node version | Every row identical to `main` (tick, final counts, peaks, ceiling hits, death counters). On Node 25.2.1 macOS arm64, the runtime used for `docs/experiments/balance.json`, that means **18/50**; Node 22.22.2 Linux x64 gives 19/50 for unmodified `main` |
| Existing tests | `npm test` | All current tests pass unchanged |
| Food-web fixtures | New unit tests with hand-placed animals | A hungry vole in a seeded tall-grass patch eats seed (stock falls by the bite, energy rises by 14); a vole at a bush gains a quarter of its seed value; rabbits never eat seed; a hungry fox catching a vole gains 40% of its meal; voles sense foxes as threats and foxes sense voles as food |
| Refuge | Fixture | A fox beyond `coverSight` does not sense a vole in tall grass; a vole in tall grass moves at full speed |
| Death attribution | Fixture | Vole deaths are counted as starved, eaten, old or illness, and never in rabbit counters |
| Determinism | Same seed, settings and action hours, twice, in the Vole meadow | Identical populations, counters and grass seed every hour for a year |
| Checkpoint | Save at hour 1000, restore, run to 3000 | Identical to an uninterrupted run, including grass seed and every RNG stream |
| Old saves | A stored version-2 save fixture from the current code | Loads as a two-species world and continues identically to the current engine for 500 hours; a corrupted fixture shows the clear message |
| Hidden scenario | Unit test on the list the picker uses | `voles` is not offered until #9 |
| Performance | Sequential Node batch, seeds 9000 to 9019, ms per simulated year while all species live, both meadows on the same machine | Vole meadow median at most **1.6 times** the Open meadow median (prototype: 1.54 times, with an unoptimised seed search); Open meadow time within 5% of `main` |
| History size | Size of `RunHistory.stats` and a saved history | Stats row grows from 23 to at most 32 values; the history stays bounded to a year in Endless |
| Safeguards | Balance batch | Zero vole-ceiling hits; any ceiling-hit run is excluded and reported |

## 15. Checks for the playable-scenario issue (#9)

| Check | How to measure | Pass |
| --- | --- | --- |
| Untouched survival | 50 fresh seeds for the Vole meadow, parameters frozen before evaluation, Node and a browser worker | All three alive at a year in roughly **30 to 50%** of seeds, reported with a Wilson interval; zero ceiling hits. This is a calibration guide, as for the Open meadow |
| No single fragile species | First extinction by species across the batch | No one species causes more than 70% of first extinctions, and voles are not the first loss in most failures |
| Voles matter | The same 50 seeds with and without voles | Fox dynamics differ measurably (mean foxes, fox kits or fox starvation), reported per seed |
| Decision 1 | Scripted paired policy: when rabbits per fox fall below 5 with voles high, cull foxes, against releasing rabbits or planting | The better action differs from the same policy in the Open meadow in a measurable share of seeds; report every seed |
| Decision 2 | Scripted paired policy: cull foxes when voles fall 40% in ten days with many foxes, against waiting until rabbits fall | Early action rescues seeds that waiting loses; report rescues and spoils, as in `docs/validation.md` |
| Mistimed actions | The same policies at the wrong moment | Reported, so the trade-off is visible and no action is a free win |
| Browser identification | Manual pass, recorded with screenshots | Voles are told apart from rabbits at default zoom; vole counts, timeline line, forecast, legend, deaths table, inspector, Evolution tab, hints and result text all name voles |
| Learning | First-appearance note and guide | Shown once per device; the guide lists three species only in the Vole meadow |
| Saves | Browser | Vole meadow save and resume restores voles, grass seed and charges; an old two-species save still resumes |
| Performance | Browser worker at 1 month per second on the reference machine | Playback keeps pace in the Vole meadow; report worker chunk time against the Open meadow |
| Demo | Capture | A short recording of the Vole meadow with one of the section 8 situations |

## 16. Open questions and defaults

Each has a default that #8 and #9 can use without waiting.

| Question | Default |
| --- | --- |
| Must voles survive for a win? | Yes: all three species, and the run ends at the first extinction (section 10) |
| Which vole levers during planning? | Only Starting voles; the vole body is fixed at first |
| Voles in Drought, Harsh winter and Fox invasion? | Not in the first implementation |
| New actions? | Release voles and Vole illness only; no vole cull; mowing later |
| Species name? | "Field vole" in the guide, "voles" in the interface |
| Endless mode in the Vole meadow? | Yes, with the same rule |
| Ordering with #3 and #4 | #3 (playtest) and #4 (intervention balance) come first. If they change an action's effect, re-check the section 8 situations before tuning voles |

## Appendix A: two-species assumptions in the code

Line numbers are from `main` at commit `ce0f820`. Each row is one place that assumes exactly
two species, or that the plant eater is the rabbit and the hunter is the fox. #8 must change
or deliberately keep each one. Other agents are editing interventions and UI on other
branches, so line numbers will drift; search for the quoted names.

**Already generic, keep:** `SpeciesDef.eats` and `eatsPlants`, the sense layout by category
(`src/sim/brain.ts` 7 to 21), the per-species loops in `move`, `hunt`, `cull`, `giveBirth`,
`findMate`, `newcomer`, `spreadIllness` and `traits(genome, eatsPlants)`.

### Simulation core: `src/sim/sim.ts`

| # | Line | Assumption | Change for #8 |
| ---: | --- | --- | --- |
| 1 | 19 | `Species = 'prey' \| 'pred'` | Add `'vole'` |
| 2 | 20 | `Intervention` names bake in species (`releasePrey`, `cullPred`, `feedFoxes`, `illnessPrey`, `illnessPred`) | Add `releaseVole`, `illnessVole` |
| 3 | 46 | `TickEvent.species` only two values | Follows `Species` |
| 4 | 68 to 72 | `World` has `prey` and `preds` only | Per-species start positions |
| 5 | 95 to 99 | `placeWorld` places rabbits then foxes | Place voles after foxes so two-species worlds stay identical |
| 6 | 102 to 113 | `Counters` fields are `preyX` / `predX` | Per-species counters (keep the old names readable for saves) |
| 7 | 124 to 129 | `speciesDefs` returns exactly two entries | Built from the scenario's species list |
| 8 | 131 | `SPECIES` constant `['prey', 'pred']` | Per-sim species list |
| 9 | 221 to 230 | `EvoCounters` are rabbit and fox measures | Keep as rabbit and fox assay measures; document |
| 10 | 255 to 263 | `counters`, `evo`, `lastBirth`, `founders`, `nextId` initialised with two keys | Per-species records |
| 11 | 269 | `grids` has two grids | One per species |
| 12 | 287 to 288 | `starts` and `pops` built for two keys | Per-species |
| 13 | 306, 317 | Save `version: 2`; restore rejects any other | Version 3 plus a version-2 migration |
| 14 | 329 to 335 | `prey` and `preds` getters | Keep; add `pops.vole` access |
| 15 | 337 to 339 | `survived` checks rabbits and foxes | All species in the list |
| 16 | 429 to 433 | Step ends when rabbits or foxes are gone | Any species in the list |
| 17 | 452, 479, 887 | Bush events are tagged species `'prey'` | Tag as plant events, not a species |
| 18 | 516 | Threat encounters counted only for `'prey'` | Keep for the rabbit assay |
| 19 | 646 | `graze` uses `p.prey` body for every plant eater's fullness | Use each species' body (a real bug once a second plant eater exists) |
| 20 | 655 to 665 | `graze` takes one whole berry per bite at full value | Per-species bite size and berry value; grass seed for voles |
| 21 | 670 | `evo.preyIntake` counts any plant eater | Rabbits only |
| 22 | 682 | `predHungryHours` counts any hunter | Foxes only |
| 23 | 707 | Hunter gains its own `mealEnergy` whatever it catches | Scale by the victim's meal value |
| 24 | 709 | Every kill increments `counters.preyEaten` | Count by victim species |
| 25 | 728 to 740 | `cull` maps anything not `'prey'` to fox counters | Per-species counters |
| 26 | 795 to 796 | `giveBirth` maps anything not `'prey'` to `predBorn` | Per-species |
| 27 | 873 | Illness action maps to `'prey'` or `'pred'` only | Add voles |
| 28 | 891 | `feedFoxes` uses `p.pred` | Keep, fox-only |
| 29 | 896 to 930 | Release and cull branches are written per species | Add release voles |
| 30 | 981 to 1000 | `RunResult` has `prey_end` and `predator_end` | Add a per-species map |

### Parameters, levers and scenarios

| # | File and line | Assumption | Change for #8 |
| ---: | --- | --- | --- |
| 31 | `src/sim/params.ts` 49 to 50 | `ceilingPrey`, `ceilingPred` | Add `ceilingVole` |
| 32 | `src/sim/params.ts` 77 to 78 | `SimParams` has `prey` and `pred` bodies only | Optional `vole` body plus grass-seed values |
| 33 | `src/sim/levers.ts` 6 | `LeverSpecies = 'prey' \| 'pred' \| null` | Add `'vole'` |
| 34 | `src/sim/levers.ts` 32, 118 to 119, 155 to 156, 182 to 184 | `species()` switches ranges and labels on `prey` true or false | Per-species labels and ranges |
| 35 | `src/sim/levers.ts` 208 to 236 | Population levers and `species()` calls for two species | Add Starting voles only |
| 36 | `src/sim/levers.ts` 349 to 361, 389 to 392 | `defaultLevers` and `deriveParams` fill two species | Add the vole |
| 37 | `src/sim/scenarios.ts` 4, 28, 30 | Scenario ids and "keep both species alive" copy | Add `voles`, a species list per scenario |
| 38 | `src/sim/scenarios.ts` 54 | Fox invasion arrival species | Unchanged |
| 39 | `src/sim/evolution.ts` 9 | `inheritedTraits` decides plant eater by `species === 'prey'` | Use the species definition |
| 40 | `src/sim/evolution.ts` 20, 37 | `EvolutionSample` has `prey` and `pred` fields | Per-species map (the UI type-checks against this; widening `Species` alone breaks `evolution-panel.tsx`) |
| 41 | `src/game/presets.ts` 4 to 40 | `STABLE_PRESET` lists rabbit and fox keys | Add vole keys only in the Vole meadow preset |

### Worker, history, saves and game logic

| # | File and line | Assumption | Change for #8 |
| ---: | --- | --- | --- |
| 42 | `src/worker/protocol.ts` 10 to 35 | `STAT` row of 23 rabbit and fox columns | Append vole columns at the end |
| 43 | `src/worker/protocol.ts` 40 | Event species encoded 0 prey / 1 pred | Add 2 for voles |
| 44 | `src/worker/protocol.ts` 43 to 50 | `FrameData` has `prey` and `preds` arrays | Add `voles` (empty in the Open meadow) |
| 45 | `src/worker/protocol.ts` 59 to 64 | `EndInfo` has `preyEnd`, `predEnd` | Add `voleEnd` or a per-species map |
| 46 | `src/worker/sim.worker.ts` 24 to 26 | `packAnimals` chooses between two populations | Any species |
| 47 | `src/worker/sim.worker.ts` 79 | Event species index is prey or not | Species index |
| 48 | `src/worker/sim.worker.ts` 92 to 127 | `writeStats` writes rabbit and fox statistics only | Add vole statistics and grass seed |
| 49 | `src/worker/sim.worker.ts` 129 to 132 | `endInfo` | Add voles |
| 50 | `src/game/history.ts` 20 | `highestGeneration` has two keys | Per species |
| 51 | `src/game/history.ts` 41 to 50 | Journal labels Rabbit or Fox, "Both species reached year" | Per-species labels; "All species" |
| 52 | `src/game/saves.ts` 7, 46 | Save version 2 only | Version 3 plus migration |
| 53 | `src/game/controller.ts` 46 to 52, 169 to 175 | `Snapshot` has `prey`, `pred`, `preyEnergy`, `predEnergy`, `predKits10d` | Add vole fields |
| 54 | `src/game/controller.ts` 268 | Writes save version 2 | Version 3 |
| 55 | `src/game/interventions.ts` 2 to 10 | Eight actions, rabbit and fox copy | Two vole actions, shown only in the Vole meadow |
| 56 | `src/game/insights.ts` 14 to 19, 24, 47 | `Forecast` and trend keys for two species | Add voles |
| 57 | `src/game/insights.ts` 54 to 152 | Hints written for rabbits and foxes | Vole hints (section 8) |
| 58 | `src/game/insights.ts` 186 to 274 | `explain` assumes the extinct species is rabbits or foxes (199) | Vole branch, and fox starvation that mentions voles |

### Rendering and interface (#9)

| # | File and line | Assumption |
| ---: | --- | --- |
| 59 | `src/render/renderer.ts` 2, 38 to 39, 51 to 52, 102 to 103, 143, 163 to 164 | Two sprite sheets and two draw calls |
| 60 | `src/render/renderer.ts` 32 to 36, 127 to 129 | Event effects decide "fox or not" from species index 1 |
| 61 | `src/render/sprites.ts` 222 to 232 | `animalIcon(kind: 'prey' \| 'pred')` |
| 62 | `src/hooks/use-animal-icons.ts` 4 to 5 | Icons object has `rabbit` and `fox` only |
| 63 | `src/index.css` 132 to 133 | Colour tokens for rabbit and fox only |
| 64 | `src/components/evolution-panel.tsx` 12 to 72 | Species select and labels for two species |
| 65 | `src/components/guide.tsx` 18 to 31, 57 | Guide rows and win rule for two species |
| 66 | `src/components/lever-panel.tsx` 161 to 172, 224, 242 to 252 | Species columns and readouts for two species |
| 67 | `src/components/run-panel.tsx` 39 to 45, 59 to 60, 86 to 88, 97 to 102, 147 | Action icons, death table rows, illness summary, forecast |
| 68 | `src/components/timeline.tsx` 58 to 67, 124 to 139, 180 to 184, 243 to 244 | Two lines on two scales, two labels |
| 69 | `src/components/world-view.tsx` 49, 57 to 58, 70, 86 to 87, 113 | Picking, counts and canvas label for two species |
| 70 | `src/App.tsx` 163 to 164, 213 to 217 | Header icons and timeline legend |

### Scripts and tests

| # | Files | Assumption |
| ---: | --- | --- |
| 71 | `scripts/*.ts` (validate-balance, sweep, balance-grid, balance-try, deaths, evo-assay, fox-births, intervention-assay, browser-balance.worker) | Read `s.prey`, `s.preds` and `counters` names directly; must keep working for the Open meadow |
| 72 | `tests/*.ts` (game, interventions, endless, controller) | Use two-species fields; must pass unchanged as the regression guard |

**Count: 72 sites** (58 in simulation, worker, history, saves and game logic; 12 in rendering
and interface; 2 groups of scripts and tests).

## Appendix B: reproducing the prototype

The prototype is on the local branch `third-species-prototype` (commit `df11088`), which
is never merged. Its engine changes are marked `PROTOTYPE` in `src/sim/sim.ts` and
`src/sim/params.ts`. The runner, raw JSON per batch and the analysis script were kept with
the session scratch files, not in the repository:

- `proto.mts` runs one batch: `node --import tsx proto.mts <base|vole|hawk> <first seed> <count> <out.json> '<overrides JSON>'`.
- `final-base.json`, `final-vole.json`, `final-hawk.json`, `final-vole-naive.json` hold every
  seed's extinction hours, mean and peak populations, births, deaths by cause, kills, ceiling
  hits and timing.
- `analyse.py` prints the table in section 3.

Frozen overrides used for the fresh batches:

```text
vole        {"grass":{"max":20,"every":6},"berryScale":0.25,"mealScale":0.4,
             "body":{"mealEnergy":14,"metabolism":0.22,"litter":3,"adultAge":40,"birthGap":96}}
naive vole  {"mealScale":0.35,
             "body":{"mealEnergy":14,"metabolism":0.22,"litter":3,"adultAge":40,"birthGap":96}}
hawk        {"coverSight":0,"ceiling":120,
             "body":{"initial":3,"birthGap":400,"mealEnergy":60,"step":0.018,"baseStep":0.018,"metabolism":0.12}}
```

Other vole body values are those in section 5. The hawk's other values: maxEnergy 150,
lifespan 1100, adultAge 150, litter 1, speedCost 0.8, breedEnergy 0.9, childEnergy 0.55,
visionUpkeep 0.03, view [0.15, 0.6], turn [0.3, 0.9].
