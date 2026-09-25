# Meadow Keeper roadmap

The player’s job is to recognise developing trouble and intervene. A meadow that always
balances itself is not the goal. Untouched survival around 30–50% is a calibration target;
readable warning signs, enough time to respond, and useful choices are the gameplay gates.

## Current update

- [x] Continue from `saved-progress`, including living vegetation and tall grass.
- [x] Remove night dimming; retain the clock and seasonal scenery.
- [x] Remove population-cap levers. Record safety-ceiling hits and exclude them from balance evidence.
- [x] Make hunting physical and hunger-driven; charge energy for movement and senses.
- [x] Report starvation, predation, age, illness and deliberate culling separately.
- [x] Compare evolving, fixed-founder-pool and selection-only controls in common arenas.
- [x] Show trait distributions, generations, founder lineages and animal inspection.
- [x] Add an evidence-based journal of lineage and generation milestones.
- [x] Add Endless mode with recurring weather, bounded replay and a real 365-day challenge.
- [x] Save/resume world state, all random streams, recent replay and evolution observations.
- [x] Expand interventions: rain, planting, releases, fox culling, fox feeding and illness in either species.
- [x] Start at one day per second so players have time to notice and react.
- [x] Validate 30–50% untouched survival on fresh seeds, plus useful intervention strategies.
- [x] Capture the updated demo and Evolution view.
- [x] Prepare the commits and supporting experiment reports for review.

Identical seed + settings + intervention actions/times gives identical simulation outcomes
within the same runtime/version; exact cross-engine trajectories are not guaranteed.
Different seeds create different worlds. Replay and save/resume preserve this property.
The four-use intervention budget is shared by eight choices. The one-year challenge keeps
four for the year.

Endless intervention budget (issue #5): Endless now renews one use at the start of each season
(1 Dec, 1 Mar, 1 Jun, 1 Sep), holding at most four, with the 400-hour cooldown unchanged. We
compared this with the old four-per-run budget, a 30-day recovery and a yearly refill using a
greedy keeper over three years on five seeds (`docs/experiments/endless-budget.json`). The
four-per-run budget left long Endless runs with no uses after year 1, and a playtest player out of
answers for the winter crash. The 30-day recovery was almost never short, so it removed
scarcity. The yearly refill was spent in an autumn burst and left winter bare. The seasonal rule
keeps uses scarce, returns one as winter begins, and is shown in the panel as uses left plus the
next renewal date. See the Endless intervention budget section in `game-design.md`.

## Next: a third animal species

Choose a distinct role in the food web, such as alternative prey competing for plants.
Show what it eats and what eats it; extend death causes and inspection consistently.
Gate: it creates new, understandable player decisions and does not merely add more animals.
Keep the existing two-species scenario as a comparison and introduction.

## Then: evolving bodies and ecological varieties

Add visible, inherited morphology with explicit energy trade-offs. Track persistent trait
clusters and niches over generations before calling them subspecies. Expand the journal
with evidenced changes and family relationships; distinguish observations from explanations.
Gate: the player can identify an adaptation and its cost in the meadow itself.

## Later: growing brains

The saved branch includes experimental structural mutation and memory. They remain assay
variants; default play uses a fixed linear controller until added complexity demonstrates
useful behaviour under controlled comparisons. Gate: repeatable behavioural gains, readable
player feedback, and acceptable performance. Greater ecosystem stability is not a required
consequence of better individual adaptation.

Save/resume and the small journal were brought forward because they make long-lived worlds
worth following now, before these larger additions.
