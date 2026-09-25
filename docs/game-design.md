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

### Inherited body size (issue #10)

Controllers change behaviour, which is hard to see. One visible body trait, **body size**,
makes adaptation show in appearance. It is written here before it was implemented.

- **Gene.** One number `g` per animal, carried in its genome next to the controller weights,
  bounded to [-1, 1]. Body size is `m = 1.25^g`: from ×0.80 (small) through ×1.00 (neutral,
  `g = 0`) to ×1.25 (large). Every species has it; each species keeps its own base body, so
  a large rabbit is still a rabbit and still far smaller than a fox.
- **Founders** draw `g` uniformly from [-spread, spread] (default spread 1: the whole range).
  Released and arriving animals copy a living ancestor's gene, then mutate it.
- **Inheritance.** A child copies its parent's gene; in sexual variants it takes either
  parent's gene with equal chance. Founder-pool controls sample founder genomes, sizes
  included. **Mutation**: with the per-gene mutation rate (the Mutation lever), add a normal
  step of σ = 0.1, then clamp to [-1, 1].
- **Effects**, each multiplying that species' base value:

  | Quantity | Scales with | Large ×1.25 | Small ×0.80 | Why |
  | --- | --- | --- | --- | --- |
  | Max energy (reserves) | `m` | +25% | −20% | bigger store for lean times |
  | Basal metabolism | `m^0.75` | +18% | −15% | a bigger body costs more to run |
  | Top speed | `m^-0.5` | −11% | +12% | small is nimble |
  | Movement energy | `m` × (speed / reference speed)² | +25% at equal speed | −20% | heavier body to move |
  | Plant bite (food removed and energy gained) | `m` | +25% | −20% | bigger mouthfuls: fills faster, strips bushes faster |
  | Catch reach | `eatR × (m_hunter + m_victim) / 2` | reaches further; easier to catch | shorter reach; harder to catch | body radius |
  | Worth as a meal to a hunter | `m` of the victim | +25% | −20% | more meat |
  | Breeding threshold and energy given to each young | fraction of own max energy | +25% in absolute energy | −20% | bigger young cost more |

  At full pace every size pays the same movement energy per hour, so per distance a large
  body pays about 12% more and a small one about 11% less. Hunger (sensed and shown) is
  energy as a share of the animal's own maximum. Vision, brain upkeep, turning, lifespan,
  maturity and litter size do not depend on size.
- **Nothing is free.** Large: more reserves, faster refuelling, longer reach and bigger meals
  for hunters; but slower, dearer to run and to breed, easier to catch and a richer meal.
  Small: faster, cheaper, harder to catch; but lower reserves, slower refuelling, shorter reach.
- **Off switch.** `eco.body` absent means body evolution is off: every animal is exactly
  ×1.00, no random numbers are drawn for it, and a meadow runs identically to one without
  the feature. Genes in a genome are ignored while it is off.
- **Display.** The sprite is drawn at `m` times its size (on top of the juvenile scale).
  Hunger keeps its dashed ring and illness its purple ring, so a thin or sick animal is never
  drawn smaller. The inspector reports the inherited size; Evolution charts its mean and
  middle 80%.
- **Saves.** The gene is in the saved genome and the derived body values on each animal; a
  save from before this change loads with every animal at ×1.00.

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
