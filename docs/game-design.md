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

| Intervention | Effect and trade-off |
| --- | --- |
| Rain | Restocks existing bushes; can fuel a population boom. |
| Plant bushes | Adds up to four half-stocked bushes; they can still wither. |
| Release rabbits | Eight descendants of living rabbits near food. |
| Release foxes | Three fed foxes at the edge. |
| Cull foxes | Immediately removes a third, leaving at least one. |
| Feed foxes | Refills energy, reducing immediate hunting but potentially enabling births. |
| Rabbit illness | Infects up to six rabbits; spreads within the species and raises energy costs. |
| Fox illness | The same process in foxes; slower and less predictable than an immediate cull. |

Illness is an abstract game mechanic: ten days of additional energy costs per case, local
spread, then temporary immunity. Purple rings show ill animals. Illness can cause extinction;
it is not a guaranteed precisely sized cull. There are no spontaneous outbreaks in this update.

## Observation and learning

Field notes show risks, recent trends, current illness, and cumulative deaths by cause.
Population history can be scrubbed. The Evolution page probes inherited controllers in
standardised situations and plots mean and middle-80% variation; founders are a dashed
reference. Probed inherited tendencies are distinct from current animal movement.

Click an animal or choose it from the inspector to pause and read its age, energy, health,
generation, parent, lineage, offspring and inherited responses. The journal records observed
generation and lineage milestones, without inventing causal evolutionary explanations.

## Time, persistence and scoring

The challenge is 8,760 hours, starting 1 September at 08:00. Day/night dimming is removed.
Seasonal scenery remains. In Endless mode, seasonal disturbances recur each year; a fox
invasion is a one-time event. Endless starts with four intervention uses and renews one at the
start of each season, holding at most four (below).

### Endless intervention budget

The one-year challenge keeps four uses for the year. Endless used to share the same four across
an unlimited run, so after them the player could only watch: in playtest session 3 the Endless
player had used three by day 94 (4 Dec) and could not answer the winter crash on day 110, and
said every use "feels like a mistake unless it's in winter". We compared four rules with a greedy
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
founder reference plus the latest year, and the journal retains its latest 80 milestones.
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
