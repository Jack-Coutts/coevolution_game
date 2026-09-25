# Coevolution: Meadow Keeper

Tune a meadow, watch its inhabitants adapt, recognise trouble and intervene. Both rabbits
and foxes must survive a full 365-day challenge, or continue indefinitely in Endless mode
until one species disappears. The intended untouched win rate is roughly 30–50%, not perfect
stability. See `validation.md` for actual measured results and limitations.

## Simulation

One tick is one hour. Founders receive random inherited controllers. Offspring inherit
with mutation. Default brains are linear; hidden layers, memory and structural growth are
experimental assay variants retained from the saved-progress branch.

Animals burn metabolism, vision upkeep and quadratic movement energy. A hungry fox catches
a rabbit when their positions are within physical reach after movement. There is no
catch-chance setting. Fed foxes do not hunt. Reproduction requires maturity, a birth gap and
sufficient energy, and transfers energy from parent to child. Deaths distinguish starvation,
predation, old age, illness-related energy exhaustion, and deliberate fox culling.

The meadow grows new bushes at seasonal rates. Overgrazed bushes wither; tall grass hides
rabbits beyond close range and slows movement. Population ceilings are technical safeguards,
not player levers: any ceiling-hit run is flagged and excluded from balance claims.

## Player choices

Before release, change parameters within 30 points. During the run, four intervention uses
are shared by eight options, with 400 hours between uses:

| Intervention | Effect | Useful situation | Failure mode | Evidence (60-day prevented / caused, tuning seeds) |
| --- | --- | --- | --- | --- |
| Rain | Refills every bush; a refilled bush stops withering | Few bushes (20 or fewer) under 20% full | A rabbit boom with 20+ foxes: feeds the next fox boom | 3 / 1 vs 1 / 11 |
| Plant bushes | Up to four half-stocked bushes; they can still wither | 20 or fewer bushes | 40+ bushes: little room (limit 48) and little effect | 8 / 3 vs 3 / 3 |
| Release rabbits | Eight descendants of living rabbits near food | 60 or fewer rabbits | 250+ rabbits with 20+ foxes: mostly feeds foxes | 12 / 1 vs 1 / 5 |
| Release foxes | Three fed foxes at the edge | 5 or fewer foxes | 20+ foxes with under 8 rabbits each: more hunting pressure | 7 / 0 vs 9 / 14 |
| Cull foxes | Removes a third at once, leaving at least one | Overhunting: under 5 rabbits per fox and rabbits falling | 8 or fewer foxes: risks losing them; foxes regrow within weeks | 14 / 5 vs 1 / 4 |
| Feed foxes | Refills fox energy; fed foxes stop hunting briefly, then breed | 6 or fewer foxes | Overhunting: extra births while rabbits fall | 5 / 0 vs 7 / 15 |
| Rabbit illness | Up to six cases; spreads through the warren | None found; intended for a rabbit boom on bare bushes | 60 or fewer rabbits: extinct within 60 days in 12/34 tuning runs | 0 / 4 vs 5 / 5 |
| Fox illness | Up to six cases; peaks within 3–7 days, gone within a month | 20+ foxes with under 8 rabbits each, before the crash | 8 or fewer foxes: extinct within 60 days in 6/18 tuning runs | 15 / 8 vs 1 / 4 |

These are situations a fixed rule found helpful over 60 days, not optimal play. On 20
held-out seeds no action, nor a keeper using all eight, improved year survival beyond what a
0.0001 nudge to one rabbit does: the meadow is chaotic, so single actions reshuffle outcomes.
Rabbit illness has no demonstrated beneficial use; it is kept as a high-risk tool. See
`validation.md` for the paired counts, illness outbreak shape and limitations.

Illness is an abstract game mechanic: ten days of additional energy costs per case, local
spread, then temporary immunity. Purple rings show ill animals. Illness can cause extinction;
it is not a guaranteed precisely sized cull. There are no spontaneous outbreaks in this update.

## Observation and learning

Field notes show risks, recent trends, current illness, and cumulative deaths by cause.
Population history can be scrubbed. The Evolution page probes inherited controllers in
standardised situations and plots mean and middle-80% variation; founders are a dashed
reference. Probed inherited tendencies are distinct from current animal movement.

Click an animal or choose it from the inspector (sorted by generation, family or id) to pause
and read its age, energy, health, generation, offspring and inherited responses. Its family links
lead up and down: a living parent is selected directly; a dead one shows when it was last seen,
with a link to that hour while the replay still holds it (otherwise "died before the kept
replay"). Living offspring and the founder family are links too. A selected animal that is not
alive at the displayed hour shows when it died, or that the kept replay does not show it.

### Evolution journal

Entries are typed (`src/game/journal.ts`), each with the measurement it came from, a category
(family, measured change, population outcome) and, where useful, links to an animal, a founder
family or the trait chart. Entries observe; a caveat says what the observation does not show.
No entry claims why something happened, and trait trends are never presented as an advantage.

| Kind | Evidence | Threshold |
| --- | --- | --- |
| Generation | Highest living generation, daily sample | Each new multiple of 5, once |
| Lineage | Founder families alive, daily sample | Falls from more than 1 to 1 |
| Trait shift | Daily trait mean and middle-80% band | Mean at least 0.25 from the first measurement (founders, or first sample with 10+ animals) for 20 daily samples in a row, each with 10+ animals; once per trait and direction until the mean returns within 0.125 |
| Extinction | Living count, daily samples | Above 0, then 0 |
| Year | Both counts at a new year's first sample | Both above 0 |
| Variety | Reserved for ecological varieties (issue #11) | Supplied by the detector; one entry per key until released |

Samples with fewer than 10 animals neither extend a trait run nor count as a return, so an
extinction does not read as a trait change. The journal keeps its latest 80 entries and says how
many were dropped. The Families card counts each founder's descendants daily from frames (share
of the living animals, generations, largest size, first and last count). Daily counts cover
about a year; older days survive only as each family's first count and largest size, and at most
40 extinct families per species are kept, which the Endless page states. Journal state, trait
latches and family counts are saved with the meadow; journals from older saves load as notes.

## Time, persistence and scoring

The challenge is 8,760 hours, starting 1 September at 08:00. Day/night dimming is removed.
Seasonal scenery remains. In Endless mode, seasonal disturbances recur each year; a fox
invasion is a one-time event. Endless starts with four intervention uses and renews one at the
start of each season, holding at most four (below).

### Endless intervention budget

The one-year challenge keeps four uses for the year. Endless used to share the same four across
an unlimited run, so after them the player could only watch: in playtest session 3 the Endless
player had used three of four by 4 Dec (day 95), with one left for an unlimited run, and
the rabbits died out on day 110. The player said every use "feels like a mistake unless it's in
winter". Renewal does not shorten the cooldown, so a crash inside it still goes unanswered. We compared four rules with a greedy
threshold keeper (`scripts/endless-budget.ts`, seeds 7300–7304, stable and harsh-winter, up to
three years; `docs/experiments/endless-budget.json`):

| Rule | Uses per year (stable, mean) | Days wanting to act with none left (stable / winter) | Verdict |
| --- | --- | --- | --- |
| Four for the whole run (old) | 4 / 0 / 0; every run past year 1 used none in year 2 | 90 / 57 | Endless becomes watch-only after autumn. |
| +1 every 30 days, cap 4 | 9.4 / 5.6 / 3.6; up to 16 in a year | 3 / 2 | Almost never short: only the cooldown limits it, so no scarcity. |
| Refill to four each 1 Sep | 4 / 2.4 / 0.8 | 60 / 23 | Spent in an autumn burst, then months with none, including winter. |
| **+1 at each season start, cap 4 (chosen)** | 5.6 / 1.2 / 0 (runs reaching year 2 used 4 and 2 there) | 47 / 17 | Still scarce, and a use returns on 1 Dec, as winter begins. |

Chosen rule: one use comes back at 00:00 on 1 Dec, 1 Mar, 1 Jun and 1 Sep, with at most four
held, and the 400-hour cooldown unchanged. At most eight uses fit in the first year and four a
year after that, so a player still has to choose when to act, and saving uses has a ceiling.
Survival under the keeper is not the test: it acts on every trigger, and on these five seeds
survival did not rise with more uses (the no-renewal keeper sometimes lasted longest because it
could not act). Uses are recomputed from the recorded intervention hours by one pure function
(`src/game/budget.ts`), so replay, save and resume cannot create or lose a use. The panel shows
uses left and the date of the next renewal. Endless scoring is unchanged (hours survived).

A rolling year of statistics and replay bounds memory. Daily evolution samples retain the
founder reference plus the latest year, the journal retains its latest 80 entries, and
family counts retain about a year of days.
A save includes the displayed hour's exact world, every RNG state, queued actions, charges/cooldown, recent
15-day replay, and evolution observations. There is one device-local IndexedDB slot; saving
replaces it. Resume is paused. It does not regenerate the world from the seed.

Within the same runtime/version, the same seed, parameters and intervention timing produce
the same outcome. Exact trajectories across engines are not guaranteed. Different
seeds vary the starting world. Rendered gait animations are decorative and do not affect
simulation results. Default playback is one day per second, giving time to respond.

Score is hours survived. A successful challenge also awards up to 300 unspent-budget points
and 400 calm points, reduced by 100 per intervention. Endless scores are survival time only.
Scores have a new version and are separated by mode to avoid mixing old balance results.

## The Vole meadow

The fifth scenario (after the Open meadow, Drought, Fox invasion and Harsh winter) adds field
voles to the Open meadow preset, with no weather. The Open meadow stays the default and the
practice meadow (seed 5007) is unchanged. Design record: `third-species.md`.

- **Food web.** Voles eat grass seed in the tall grass and nibble berries when seed runs short.
  Foxes eat voles and rabbits; a vole is 40% of a fox meal. Tall grass hides voles as it hides
  rabbits and does not slow them. The planning panel shows a "Who eats whom" card.
- **Rule.** All three species must be alive at the end of the year; the run ends at the first
  extinction of any of them, in the challenge and in Endless.
- **Choices.** One extra lever, Starting voles (20 to 150, default 60), only in this meadow. The
  Tall grass lever now also sets vole food. Ten interventions share the same four uses and
  cooldown: the eight above plus Release voles (twelve voles into tall grass) and Vole illness.
  No action removes voles directly.
- **Identity.** A small, rounded slate-grey sprite with tiny ears and a thin tail, two thirds of
  a rabbit. The UI colour is `--color-vole`, a slate blue (light `oklch(0.5 0.09 250)`, 5.8:1 on
  the card; dark `oklch(0.78 0.08 250)`, 9.0:1). Voles appear in the HUD, status strip,
  timeline (on the rabbits' left scale), forecast, deaths table, illness note, inspector and
  picker, the Evolution page tiles and trait charts, the journal and the guide. Vole births and
  starvation have no map effect (there are thousands); deaths to foxes use the eaten effect.
- **Field notes.** Grass seed nearly gone (voles move to the bushes), vole boom, vole crash with
  many foxes ("the foxes that lived on them will turn to rabbits"), few voles left, and a
  forecast of vole extinction. With 100 or more voles, the overhunting warning adds that a fox
  cull can set off a vole boom that strips the bushes.
- **Explanations.** A vole extinction is explained by its main cause (starved on bare seed,
  eaten out, illness, old age); fox starvation names voles when voles were most of the foxes'
  recent catch.
- **The decision it creates.** Culling foxes during overhunting also frees the voles. On paired
  seeds the same cull at the same warning had a different best alternative on 8 of 20 seeds
  with voles present, in both directions, and turned a surviving meadow into a loss on three (see `validation.md`).

## Validation

Keep adaptation and ecological resilience separate. The common-garden assay compares
identical test worlds/opponents for evolved populations, founder-pool controls and
selection-only populations. Founder-pool newborns independently sample the original genome
pool, breaking inherited reproductive selection. Mutation-off alone still permits evolution
by selection. Missing late snapshots are disclosed; behavioural results at late dates are
conditional on populations still being alive.

Tests cover determinism, physical movement/hunting, energy and reproduction, intervention
effects, illness attribution, checkpoint continuation and bounded Endless history. Balance
reports include every seed, deaths, population peaks and safety-ceiling hits.
