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
Population history can be scrubbed. The Evolution tab probes inherited controllers in
standardised situations and plots mean and middle-80% variation; founders are a dashed
reference. Probed inherited tendencies are distinct from current animal movement.

Click an animal or choose it from the inspector to pause and read its age, energy, health,
generation, parent, lineage, offspring and inherited responses. The journal records observed
generation and lineage milestones, without inventing causal evolutionary explanations.

## Time, persistence and scoring

The challenge is 8,760 hours, starting 1 September at 08:00. Day/night dimming is removed.
Seasonal scenery remains. In Endless mode, seasonal disturbances recur each year; a fox
invasion is a one-time event. The four intervention uses last the entire run.

A rolling year of statistics and replay bounds memory. Daily evolution samples retain the
founder reference plus the latest year, and the journal retains its latest 80 milestones.
A save includes the exact world, every RNG state, queued actions, charges/cooldown, recent
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
