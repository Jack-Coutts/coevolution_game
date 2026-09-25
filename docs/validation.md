# September 2026 validation

This update builds on the ten development commits after the prototype snapshot in
`saved-progress`. The measured default is the
linear inherited controller, with living bushes and tall grass. Hidden layers, memory and
structural growth remain experimental variants, rather than presumed improvements.

## Untouched balance

Parameters were tuned on exploratory seeds, then frozen before seeds **5000–5049**.
The [50-seed report](experiments/balance.json) contains the full parameters, outcomes,
population peaks and deaths. Node 25.2.1 on macOS arm64 produced:

- **18/50 survived a full year: 36%.** This is a sample estimate, not a promised win rate
  for every group of seeds. A 95% Wilson interval is approximately 24–50%.
- **Zero population safety-ceiling hits.** Peak populations across this batch were
  672 rabbits and 288 foxes, below safeguards of 800 and 400.
- Fox deaths: 8,504 energy starvation, 7,333 old age. Hunting has no catch-probability gate.
- The target is a playable starting balance, not a self-stabilising ecosystem. The Drought,
  Harsh winter and Fox invasion variants have not been independently calibrated to 30–50%.

The same seeds in the [Chrome 153 browser-worker check](experiments/balance-browser.json)
produced **23/50 survivors (46%)**, also with **zero safety-ceiling hits**. Both tested
runtimes fall in the intended range. These are the same 50 seeds in two runtimes, not 100
independent trials. To reproduce the browser check, run the dev server and open
`/scripts/browser-balance.html` in the browser being tested.

## Does intervention help?

Short answer: every action has a situation where it helps over the next 60 days, but a
fixed heuristic does not reliably change **year** survival, and the 20 held-out seeds did
not confirm the short-term gains. This is evidence about the actions and a fixed rule, not
about skilled play.

**Method.** `scripts/action-probes.ts` defines, for each action, a *timely* situation and a
plausible-but-wrong *mistimed* one, read only from on-screen signals (counts, berry stock,
mean energy, 10-day trends). `scripts/action-assay.ts` runs each seed untouched; each action
once at the first hour at or after 240 where its situation holds (timely, then mistimed);
fox illness at the hour a cull would be used; a *keeper* that uses all eight with the game
budget (4 charges, 400-hour cooldown, two charges kept for releases/feeding/culls); and a
placebo *nudge* that moves one rabbit 0.0001 at hour 241. Rows record action hours and
signals, outcomes, deaths by cause, 30-day populations, illness shape and ceiling hits.
Pairs with a ceiling hit are excluded from balance claims (there were two runs on tuning
seeds, none on evaluation seeds). Node 22.22.2, Linux x64, four worker processes.

- Tuning seeds **8000–8039**: situations were chosen from 60-day branches at checkpoints
  every 480 hours ([summary](experiments/actions-explore.json)), then the paired assay was
  run ([actions-tuning.json](experiments/actions-tuning.json), 1,447 s;
  [keeper with reserve](experiments/actions-tuning-keeper.json)).
- Evaluation seeds **8100–8119**, run once with everything frozen
  ([actions-final.json](experiments/actions-final.json), 1,552 s). A 100-seed evaluation
  (8100–8199) was started and stopped part-way to free a shared machine; no rows from it
  were kept, so **20 seeds is the whole held-out sample**.

**The chaos floor.** The meadow is chaotic: the placebo nudge changed the year outcome on
15 of 40 tuning seeds (9 improved, 6 spoiled; 19 vs 16 survived) and 5 of 20 evaluation
seeds (2 improved, 3 spoiled). Any single action reshuffles which seeds survive, so year
counts below are only meaningful where they clearly exceed that floor. None does.

**60-day branches (tuning seeds).** From each checkpoint, each action was branched for
60 days and compared with the untouched run: *prevented* = the untouched run lost a species
within 60 days and the branch did not; *caused* = the reverse. Applying an action at every
checkpoint regardless of situation gives the noise reference (for example rain 16 / 35,
planting 21 / 13).

| Action | Timely: branches, prevented / caused | Mistimed: branches, prevented / caused |
| --- | ---: | ---: |
| Rain | 58: 3 / 1 | 63: 1 / 11 |
| Plant bushes | 94: 8 / 3 | 100: 3 / 3 |
| Release rabbits | 68: 12 / 1 | 68: 1 / 5 |
| Release foxes | 24: 7 / 0 | 288: 9 / 14 |
| Cull foxes | 132: 14 / 5 | 36: 1 / 4 |
| Feed foxes | 27: 5 / 0 | 132: 7 / 15 |
| Rabbit illness | 29: 0 / 4 | 68: 5 / 5 |
| Fox illness | 288: 15 / 8 | 37: 1 / 4 |

**Held-out paired runs (20 evaluation seeds; 10/20 survived untouched, Wilson 30–70%).**
Counts are seeds improved / spoiled versus untouched, over seeds where the situation arose.

| Action | Timely arose | Year | 60 days | Mistimed arose | Year | 60 days | Timely-only / mistimed-only survivals |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Rain | 14 | 1 / 5 | 0 / 1 | 19 | 3 / 4 | 2 / 1 | 0 / 3 |
| Plant bushes | 16 | 0 / 3 | 0 / 3 | 16 | 3 / 3 | 2 / 2 | 1 / 4 |
| Release rabbits | 18 | 2 / 2 | 2 / 3 | 19 | 0 / 5 | 1 / 1 | 6 / 1 |
| Release foxes | 6 | 0 / 1 | 0 / 0 | 19 | 4 / 5 | 2 / 1 | 1 / 0 |
| Cull foxes | 19 | 1 / 2 | 1 / 0 | 8 | 1 / 3 | 0 / 1 | 2 / 1 |
| Feed foxes | 6 | 1 / 0 | 0 / 0 | 19 | 2 / 4 | 2 / 1 | 4 / 0 |
| Rabbit illness | 15 | 2 / 4 | 0 / 0 | 18 | 5 / 4 | 3 / 4 | 2 / 4 |
| Fox illness | 19 | 3 / 5 | 2 / 1 | 8 | 1 / 3 | 0 / 2 | 1 / 0 |
| Keeper (all eight) | 20 | 2 / 5 | 3 / 0 | | | | |
| Placebo nudge | 20 | 2 / 3 | 2 / 1 | | | | |

The keeper survived 7/20 against 10/20 untouched (tuning: 19/40 against 16/40, equal to the
placebo). Where evaluation agrees with tuning is the mistimed column: releasing rabbits into
a boom (0 / 5), culling or infecting a small fox group (1 / 3 each) and feeding foxes while
they overhunt (2 / 4) spoiled more seeds than they rescued. The held-out sample is too small
to confirm any timely benefit. Comparing timely with mistimed use of the same action favours
timely use for releases, culls, feeding and fox illness, and does not for rain, planting or
rabbit illness.

**Illness versus culling (evaluation seeds, medians).** A cull at the overhunting signal
removed 12 of 36 foxes at once; foxes were back to 37 thirty days later. Fox illness at the
same moment infected 42 foxes over the outbreak, peaked at 23 ill after 120 hours, killed 19
within 60 days and left 9 fewer foxes than untouched at day 30. Neither beat the placebo on
year survival. Players can watch it develop: ill foxes numbered 11, 16, 16, 4 and 0 at days
1, 3, 7, 14 and 30 (median; under 1 by day 30). Overshoot (target extinct within 60 days):

| Illness use | Tuning seeds | Evaluation seeds |
| --- | ---: | ---: |
| Fox illness, fox-heavy meadow (median 28–30 foxes) | 1/40 | 0/19 (Wilson 0–17%) |
| Fox illness, 8 or fewer foxes | 6/18 | 2/8 (7–59%) |
| Rabbit illness, 300+ rabbits on bare bushes | 5/36 | 1/15 (1–30%) |
| Rabbit illness, 60 or fewer rabbits | 12/34 | 6/18 (16–56%) |

Rabbit illness is far larger than fox illness: in a boom of about 310 rabbits it caused 969
cases and 728 illness deaths within 60 days (it reaches newborns too), peaking at 140 ill
after 205 hours.

**Tuning outcome: no mechanics changed.** The one-year budget (4 charges, 400-hour cooldown)
and all effects are unchanged; untouched runs are identical (`validate-balance.ts 5000 50`
gives the same 50 rows, 19/50 on this runtime). Rabbit illness never showed a useful situation
on tuning seeds, so four small variants were branched: drain 0.35 per hour, 120-hour illness,
spread chance 0.05 and a 40% slowdown while ill. In the rabbit-boom situation they gave
prevented / caused of 0 / 2, 2 / 2, 1 / 2 and 1 / 1 (game: 0 / 4), inside the noise, so none
was adopted. Fox illness in a fox-heavy meadow gave 21 / 12, 15 / 7, 14 / 8 and 16 / 4 under the same
variants (game: 15 / 8): no variant was clearly better. Culling was not dominated by fox
illness at 60 days (overhunting: cull 14 / 5, fox illness 8 / 7 on tuning seeds), so neither
was changed.

**Limitations.** The situations are fixed thresholds, not a model of skilled play. 20
evaluation seeds cannot confirm small effects; the 60-day branch table uses tuning seeds only.
A held-out branch check of the frozen situations (`action-explore.ts 8100 100 … --evaluate`)
is scripted but was not run. Rabbit illness still has no demonstrated beneficial use.

## Does evolution improve behaviour?

The [common-garden assay](experiments/evolution.json) uses fresh seeds **6000–6019**,
three fixed test arenas (4242–4244), and opponents sampled from independent founder seeds
900–903. Each arena lasts 240 hours with births and ageing disabled. Both conditions face
the same opponents, resource settings and arena seeds.

Conditions are evolving inheritance plus mutation, a fixed founder-pool control (newborns
sample original genes independently of parental success), and selection-only inheritance
with mutation disabled. The founder pool prevents inherited reproductive selection; simply
turning mutation off would not be a sufficient frozen control.

All 60 evolution/control runs recorded zero population safety-ceiling hits. At month one,
all 20 seeds in each condition are still available:

| Metric | Evolving | Founder pool | Paired improvement |
| --- | ---: | ---: | ---: |
| Forage intake per rabbit-hour | 0.4593 | 0.3180 | 19/20 seeds |
| Catches per fox-day | 0.09865 | 0.08932 | 16/20 seeds |
| Rabbits surviving the test arena | 73.72% | 70.56% | 14/20 seeds |
| 24-hour encounter-survival proxy | 89.28% | 89.27% | 9/20 seeds |

This supports a foraging advantage and a modest hunting advantage. There is no convincing
escape advantage at month one. The `escape` field is a proxy based on surviving 24 hours
after an encounter, not a direct measure of distance gained or a controlled escape trial.

Late samples have survivor bias: at month eight only 9/20 evolving populations remain,
compared with 13/20 founder-pool and 14/20 selection-only populations. All missing samples
are reported as missing, rather than zero or silently discarded. Year survival is
**6/20 evolving, 13/20 founder-pool, 11/20 selection-only**. Individual adaptation does not
imply more stable coexistence. Selection-only foraging at month one is 0.4680, so this
experiment also does not prove that mutation improves on selection from founding variation.
No claim is made that larger or growing brains outperform the default; the next section tests it.

## Do hidden layers, memory or growing brains help?

The linear controller plausibly falls short in three situations. It cannot keep fleeing once a fox
leaves view, because it has no memory. It cannot gate one cue by another, such as fleeing only when
not starving, or hiding only when a fox is near; that needs hidden units. It cannot trade food
against danger nonlinearly. Success was defined before running, in the fixed arenas:

- **Net forage:** energy eaten per rabbit-hour minus brain upkeep (0.01 per hidden neuron per hour).
- **Catches per encounter:** the share of fox encounters (a fox within chase range) that end in capture.
- **Flee:** while a fox is within chase range, the rabbit's next move directly away from it, as a
  fraction of top speed. This is the visible "rabbit bolts from a fox" behaviour.
- **Catches per fox-day:** evolved foxes hunting the fixed reference rabbits.

The 24-hour encounter-survival proxy is not used.

The [brain assay](experiments/brains.json) (`npx tsx scripts/brain-assay.ts 20 --start 6100 --json …`)
evolves four conditions on the same fresh seeds **6100–6119** in the two-species Open meadow for
three months. The conditions are linear, 4 fixed hidden neurons, linear plus one memory channel,
and growth from linear (a 5% chance per birth of adding a neutral neuron, up to 12). Each has a
founder-pool control of the same architecture. Snapshots from month 0 and month 3 meet fixed
opponents in fresh arena seeds 7100–7102, each 240 hours long. The opponents are linear founders
from seeds 900–903, with their memory input cut so that they behave identically in every condition.
The 160 runs took 7.0 minutes on one process, with no safety-ceiling hits.

| Month 3, evolving | Linear | Hidden 4 | Memory | Growth |
| --- | ---: | ---: | ---: | ---: |
| Populations surviving (snapshots available) | 17/20 | 17/20 | 17/20 | 18/20 |
| Net forage per rabbit-hour | 0.566 | 0.669 | 0.562 | 0.632 |
| Catches per encounter | 0.095 | 0.086 | 0.093 | 0.090 |
| Flee (fraction of top speed) | 0.005 | -0.004 | -0.010 | 0.007 |
| Catches per fox-day | 0.117 | 0.122 | 0.111 | 0.118 |
| Mean rabbit / fox hidden neurons | 0 / 0 | 4 / 4 | 0 / 0 | 0.69 / 0.26 |

The paired comparisons against linear only use seeds where both populations survived. Each gain is
the mean with an approximate 95% interval; positive favours the richer brain:

| Versus linear | Net forage | Catches per encounter | Flee | Catches per fox-day |
| --- | --- | --- | --- | --- |
| Hidden 4 | +0.088 ± 0.162, 8/14 | +0.012 ± 0.020, 8/14 | −0.006 ± 0.043, 6/14 | +0.012 ± 0.038, 9/14 |
| Memory | +0.065 ± 0.127, 10/15 | +0.007 ± 0.014, 9/15 | −0.010 ± 0.031, 8/15 | −0.010 ± 0.016, 6/15 |
| Growth | +0.064 ± 0.072, 11/17 | +0.005 ± 0.013, 10/17 | +0.001 ± 0.023, 9/17 | −0.001 ± 0.019, 8/17 |

Evolution itself works under every architecture. Against its own founder pool, each condition
improves net forage in 15–18 of 16–18 paired seeds, by +0.31 to +0.46, and fox catch rate by
+0.02 to +0.03. The extra machinery adds nothing that can be distinguished from zero:

- Every interval against linear includes zero. Growth's foraging gain comes closest, but it has
  at most 0.69 neurons per rabbit, so it is still nearly linear.
- Ecosystem survival is the same (17–18/20). The behavioural comparisons are therefore not
  driven by different survivor sets, although they do condition on survival.
- No condition evolves the visible escape behaviour. Rabbits near a fox move away at about
  0% of top speed under every brain, so a player would see no difference.

Performance cost is real. One forward pass takes 223 ns linear, 563 ns with 4 hidden neurons and
1,243 ns with 12. Whole-simulation time is 3.9 ms per 1,000 animal-hours for linear and 4.3 ms
for hidden 4 (+10%). Memory and growth stay close to linear, because they add almost no neurons.

**Decision:** no variant earns a place in normal play. The default stays the linear controller,
and hidden layers, memory and growth remain assay-only variants. Exposing brain growth in
long-running worlds (#14) is deferred until a variant shows a repeatable, visible behavioural gain
that is worth its cost. The gain should appear in this assay with an interval excluding zero,
without an ecosystem cost.

## Reproducibility and gameplay checks

The RNG is seeded. Within the same runtime/version, identical settings and intervention
hours reproduce the outcome; playback speed and rendered animations do not alter rules.
Exact cross-engine trajectories are not guaranteed; runtime math differences can accumulate
and change later encounters. Browser replay of seed 5007 repeated exactly at 308 rabbits
and 155 foxes; the Node report ended at 180 and 44. Both survived. Saved RNG and world state
are tested for exact continuation in the same runtime.

The browser check exercised the Evolution graph and animal inspector, then introduced
rabbit illness in Endless mode, advanced a day, saved and reloaded. Resume restored hour
48, 158 rabbits, six foxes, ten active rabbit cases, three remaining charges and the correct
cooldown, paused. The demo and Evolution screenshot are actual captures of the game.

Automated checks cover physical hunting, energy and births, seeded reproducibility,
founder-pool controls, illness spread/recovery/death attribution, planting/feeding,
checkpoint continuation (including hidden controller memory), repeat seasons, bounded
Endless history and journal milestones. See the README for reproduction commands.

Final local checks: **35 tests passed** across five test files; TypeScript and the production
build passed; lint completed with no errors and four existing component-export warnings.
Vite reports a roughly 507 kB main JavaScript chunk (162 kB gzip), just above its advisory
500 kB threshold. The reusable browser validation page was also checked through worker
startup and progress reporting; the recorded full browser batch used the same simulation
loop and parameters.

## Three-species engine (#8)

The field vole ([design](third-species.md)) is implemented in the engine, worker, history and
saves, with the provisional section 5 values. The Vole meadow (`SCENARIO_BY_ID.voles`) is not
in the scenario picker yet; it is for scripts and tests until #9. Measured with Node 22.22.2
on Linux x64, in a shared cloud container under heavy load (load average 12 to 14 on 4
cores), so absolute times are noisy; ratios and paired figures are the useful part.

**Two-species regression.** `node --import tsx scripts/validate-balance.ts 5000 50` gives
rows identical to the base branch (`547bf81`) in the same runtime: 50/50 rows equal in tick,
final counts, peaks, ceiling hits and every death counter; **19/50** survived on both
(`experiments/vole-sim-regression.json`). A version-2 `Sim.save()` fixture made by the base
engine loads as a two-species world and matches that engine's state digest 500 hours later
(`tests/vole-persistence.test.ts`). Open meadow step time against the base engine, same
process, interleaved, seed 9100 and 9107 for 1,500 hours: fastest runs +1.5% and +2.4%,
median paired ratio 1.05, within the noise of this machine.

**Vole meadow, untouched, fresh seeds 9100 to 9109**, against the Open meadow on the same
seeds, one run at a time, game rules (a run ends at the first extinction).
`node --import tsx scripts/vole-batch.ts 9100 10`, raw rows in `experiments/vole-sim.json`.

| Measure | Open meadow | Vole meadow |
| --- | ---: | ---: |
| All species alive at a year | 3/10 | 5/10 |
| First species lost (rabbit / fox / vole) | 5 / 2 / n/a | 4 / 0 / 1 |
| Median `sim.step` time per simulated year | 10.9 s | 16.0 s |
| Paired Vole / Open step time, median (range) | | 1.43 (1.05 to 2.30) |
| Median worker packing (frames, stats, evolution) per simulated year | 2.2 s | 2.2 s |
| Safety-ceiling hits | 0 | 0 |
| Peak voles (range over runs) | | 264 to 355 (ceiling 800) |
| Stats row | 32 values, 256 bytes | 32 values, 256 bytes |
| History stats buffer (one year) | 2.24 MB | 2.24 MB |
| Mean frame per hour, median of runs (largest frame) | 19.1 kB (42.6 kB) | 26.7 kB (53.9 kB) |
| Saved history (stats plus the last 360 frames), median (largest) | 5.8 MB (13.3 MB) | 10.9 MB (16.2 MB) |

The stats row grew from 23 to 32 values in both meadows (the version-2 buffer was 1.61 MB),
within the design's limit of 32. Replay frames are about 40% larger with voles; a full year
of in-memory replay (about 3,160 kept frames) is roughly 60 MB in the Open meadow and 84 MB
with voles. The paired step-time median of 1.43 is inside the design budget of 1.6, but
single seeds reached 2.3, where foxes grew to 200 on a vole diet; cost follows the number
of animals. Voles boom and starve as in the prototype: 89% of vole deaths were starvation,
8% predation and 3% old age. Survival here is not a balance claim; #9 tunes the scenario.

Implementation notes and deviations from the design record:

- Species and feeding are data: `FOOD_WEB` in `src/sim/species.ts` says who hunts whom, the
  plant foods in order of preference and whether tall grass slows a species; `speciesDefs`
  adds the numbers (bite, energy share per food, meal value as a victim, body, ceiling).
- Vole numbers live in one optional `SimParams.vole` block (body, ceiling, bite, berry
  value, meal value, seed stock and regrowth), not split across `EcoParams`. Two-species
  parameters are therefore unchanged and version-2 parameters stay valid.
- Death counts are per species (`Sim.tally`); `Sim.counters` remains as a read-only rabbit
  and fox view with the old names, so scripts and the stats row are unchanged.
- Plant events carry no species (encoded -1 in frames); `graze` now uses each species' own
  body for fullness (the census bug).
- Bush regrowth still adds one berry without clamping, as in version 2, so a vole-bitten
  bush can briefly hold up to 0.6 above its stock; clamping would change two-species runs
  with odd stock levers and planted bushes.
- Deferred to #9: vole levers (only an optional `vole.initial` value is read), hints and
  forecasts, full vole explanations (a plain cause summary stands in), rendering, the run
  panel's vole actions (`VOLE_ACTIONS` exists but is not shown) and picker visibility.

## Playable Vole meadow (#9)

Measured with Node 22.22.2 on Linux x64 (shared container), `scripts/vole-play.ts`, raw rows in
`experiments/vole-play-untouched.json` and `experiments/vole-play-decision.json`. Engine and
parameters are the #8 ones: no tuning pass was made, because the #8 batch (5/10) was already
inside the 30 to 50% guide.

**Untouched, fresh seeds 9300 to 9319**, default settings (60 starting voles), game rules:

| Measure | Result |
| --- | ---: |
| All three alive at a year | **6/20 (30%)**, Wilson 95% interval 15 to 52% |
| First species lost (rabbit / vole / fox) | 11 / 2 / 1 |
| Safety-ceiling hits | 0 in every run |
| Peak voles (range) | 223 to 353 (ceiling 800) |

Survival sits at the lower edge of the band. Rabbits are 79% of first losses, above the
design's 70% guide for "no single fragile species": a flag for a later calibration on a larger
batch, not tuned here.

**Decision 1: cull foxes when they overhunt, with voles present.** Each run was branched at the
first overhunting warning (10 or more foxes, under 5 rabbits per fox, rabbits down 15% in ten
days; in the Vole meadow there were 82 to 147 voles at that moment) into cull foxes, release
rabbits, or wait. Same seeds in both meadows.

| | Open meadow | Vole meadow |
| --- | ---: | ---: |
| Year survival: cull / release rabbits / wait | 9 / 7 / 10 | 6 / 3 / 6 |
| Cull lasted longer / shorter than waiting | 7 / 6 | 11 / 5 |
| Cull lasted longer / shorter than releasing | 12 / 4 | 12 / 5 |
| 30 days on, after a cull vs after waiting: voles | | 95 vs 84 |
| 30 days on: highest vole count, cull vs wait | | 149 vs 136 |
| 30 days on: barest bushes (mean fullness), cull vs wait | 9.1% vs 11.1% | 6.4% vs 8.2% |

Whether the cull or the release lasted longer differed between the meadows on **8 of 20 seeds**:
with voles the cull compared better on 9302, 9303, 9307 and 9311, and worse on 9300, 9312,
9316 and 9318. On three seeds a cull that kept the Open meadow alive for the year lost the Vole
meadow: 9300 (Vole: cull ends at hour 4289, waiting survives), 9311 (cull ends at 5899, waiting
survives) and 9318 (cull ends at 2865 with 3 foxes left a month on; releasing rabbits lasts to
5619). So the vole link makes
the familiar fix a real trade-off: the cull still helps more often than it hurts, but it frees
the voles and strips berries, and it can backfire. The new overhunting note says so.

Not measured here (left for a later pass): decision 2 (culling when voles crash), mistimed
actions, the browser worker batch and playback speed, the 50-seed batch the design asks for,
and Starting voles values other than the default.

**Browser check.** A production build (`vite build`, `vite preview`) was driven with Playwright
in light and dark themes through planning, running, inspecting a vole, the Evolution page, the
Guide and the result dialog, in the Vole meadow (seed 9302) and the Open meadow (seed 9305).
The Open meadow shows no vole lever, action, count, row or legend entry.

## Scenario calibration: Drought, Harsh winter, Fox invasion

Issue #6. The raw reports are in `docs/experiments/scenarios-*.json`, one row per run. The
scenarios use the open-meadow starting balance (`STABLE_PRESET`), and each adds one
disturbance. We tuned on seeds **8200–8219** in one pass. Then we froze the settings and
evaluated on fresh seeds **8300–8319**. Each seed runs four conditions:

- **untouched**: no actions.
- **keeper**: the scenario-blind policy from the intervention assay (#4). It reads only
  on-screen signals and uses four charges with a 400-hour cooldown.
- **informed**: the scenario's intended decision (below), triggered by the warning. The keeper
  then uses any charges left.
- **nudge**: a placebo. It moves one rabbit by 0.0001 at hour 240.

These are **20-seed samples**. A 95% interval spans about ±20 points, so every difference
below is suggestive rather than established. No run in any condition hit a population safety
ceiling (`ceilingHits` is 0 in every row), so no seed is excluded. All runs used Node 22.22.2
on linux x64 with two worker processes.

### Intended difficulty and decision

| Scenario | Disturbance | Intended difficulty | Decision the player should read |
| --- | --- | --- | --- |
| Drought | Bushes regrow at 35% from 1 May to the end of the year (unchanged) | Hardest. A late endurance test: most meadows that reach May fail without help | Save charges for the dry months. Once bushes are stripped (<25% full) during the drought, use rain |
| Harsh winter | 1 Dec–28 Feb: regrowth **60%** (was 30%), energy use **+15%** (was +35%) | Hard. Below the open meadow, but a prepared player should do clearly better | Go into winter with fewer foxes: cull on the warning if there are 12+. Rain once bushes are stripped in the cold |
| Fox invasion | 14 fed foxes arrive on 1 Nov (unchanged) | Moderate. Somewhat below the open meadow | Save charges for the pack. Cull two days after it arrives while 12+ foxes remain (within 30 days) |

The exact rules are in `PLANS` in `scripts/scenario-assay.ts`, and every report records them.

### Survival (all 20 seeds; paired changes against untouched)

| Seeds | Condition | Open meadow | Drought | Harsh winter | Fox invasion |
| --- | --- | ---: | ---: | ---: | ---: |
| Tuning 8200–8219 | untouched | 11/20 | 2/20 | 0/20 (old winter) · 3/20 (retuned) | 7/20 |
| | informed | – | 5/20 (+4 −1) | 1/20 (old winter) · 9/20 (retuned, +7 −1) | 10/20 (+5 −2, final plan) |
| | keeper | – | 3/20 (+2 −1) | 0/20 (old winter) | 7/20 (+2 −2) |
| **Final 8300–8319** | untouched | **11/20** | **2/20** | **6/20** | **11/20** |
| | informed | – | **6/20 (+4 −0)** | **9/20 (+6 −3)** | **11/20 (+3 −3)** |
| | keeper | – | 4/20 (+2 −0) | 8/20 (+4 −2) | 13/20 (+2 −0) |
| | nudge (placebo) | – | 2/20 (+1 −1) | 1/20 (+1 −6) | 11/20 (+2 −2) |

What we can and cannot claim from these samples:

- **Drought** behaves as intended. Six of 20 final seeds die before 1 May, from the open
  meadow's own dynamics. Of the 14 that reach the drought, 2 survive untouched. The informed
  decision rescued 4 and lost none on the final seeds, and rescued 4 and lost 1 on the
  tuning seeds (8 rescued vs 1 lost over both sets). The placebo reshuffled only 1 each way.
  This is the most consistent benefit in the experiment. We made no change.
- **Harsh winter** was **unwinnable as shipped**: 0/20 untouched, 0/20 keeper and 1/20
  informed on the tuning seeds, and 18 of 20 runs died during the winter. On the tuning
  seeds we tried regrowth 50% with energy +20% (2/20 untouched, 4/20 informed) and regrowth 60%
  with energy +15% (3/20 untouched, 9/20 informed), and adopted the second. On the final
  seeds it sits below the open meadow (6/20 vs 11/20), and informed play reaches 9/20. The
  placebo lost 6 of the 6 untouched survivors, though. Survival through this winter is
  highly sensitive to tiny changes, so the +6 −3 informed result is **not distinguishable
  from noise** at 20 seeds.
- **Fox invasion** does **not** measurably change difficulty on the final seeds. The result
  was 11/20 untouched, the same as the open meadow on those seeds. On tuning seeds it was
  7/20 vs 11/20. The prompt cull did not help on the final seeds (+3 −3, the same as the
  placebo's ±2). At onset the meadow already holds a median of 48 foxes, so the 14 newcomers
  add about 30%. Only 1 of 9 final untouched collapses came within 30 days of the arrival;
  the rest came 42–246 days later. A second tuning pass (below) found no setting that held
  up, so the scenario stays as shipped.

### Fox invasion: second tuning pass

This was one pass on tuning seeds 8200–8219, running untouched and informed only, with the
informed cull following the arrival. On these seeds the open meadow gave 11/20 and the shipped
invasion gave 7/20.

| Variant (tuning seeds) | Untouched | Informed (paired) | Report |
| --- | ---: | ---: | --- |
| 14 foxes on 1 Nov (shipped) | 7/20 | 10/20 (+5 −2) | `scenarios-tuning.json`, `scenarios-tuning-invasion-plan.json` |
| max(14, 60% of current foxes) on 1 Nov | 9/20 | 12/20 (+5 −2) | `scenarios-tuning-invasion-share60.json` |
| 14 foxes on 1 Oct | **5/20** | **10/20 (+6 −1)** | `scenarios-tuning-invasion-oct1.json` |
| max(14, 60% of current foxes) on 1 Oct | 4/20 | 9/20 (+8 −3) | `scenarios-tuning-invasion-oct1-share60.json` |

The 60% variants used a temporary `share` field on arrivals in `src/sim/sim.ts`. That field was
not adopted and has been removed. The 1 October arrival did best on the tuning seeds, needs no
simulation change, and was evaluated on final seeds 8300–8319
(`scenarios-final-invasion-oct1.json`). It gave **11/20 untouched**, the same as the open
meadow on those seeds. Informed play gave 9/20 (+2 −4), keeper 11/20 (+5 −5) and the placebo
8/20 (+1 −4). The tuning-seed gap did not generalise; it was within the seed-to-seed noise that
the placebo shows. We therefore kept the shipped scenario (14 foxes on 1 November) rather than
adopt an unproven change. A pack large enough to matter probably needs a larger share (at onset
the meadow already holds a median of about 40–50 foxes) or a pack that arrives hungry, and
settling that needs more than 20 seeds. The informed cull is a readable decision, but at this
sample size it is not a demonstrated rescue.

During tuning, two informed plans changed before the freeze. The first winter rule (feed
foxes when hungry) gave 1/20. The first invasion rule allowed keeper actions from the
warning, so the keeper spent charges before the pack arrived. The first-pass report
`scenarios-tuning.json` records the old rules and the old winter. The files
`scenarios-tuning-{stable,winter-a,winter-c,winter-plan,invasion-plan}.json` record the
comparisons that led to the frozen settings.

### Warnings and intervention opportunities

- **Warning lead time.** A new field note appears **14 days** before each disturbance, for
  example "Harsh winter starts in 14 days (1 Dec)." or "Foxes arrive in 3 days (1 Nov).".
  Every untouched run still alive at that point received it. That was all 14 drought,
  19 winter and 20 invasion final runs, and the note appeared exactly 336 hours before onset.
  Before this change, a Challenge player saw the dates only in the almanac and the timeline
  shading, both visible from hour 0: 242 days ahead for the drought, 91 for the winter and
  61 for the invasion. Nothing announced the disturbance as it approached. In Endless, the
  almanac lists the first year's dates, and the timeline shows the next year's span only
  about 12 days ahead. The field note now repeats every year for weather and appears once for
  the invasion (see `tests/scenarios.test.ts`).
- **Useful opportunities.** The 400-hour cooldown allows about seven actions across the
  4-month drought, six from the winter warning to 1 March, and two within 30 days of the
  arrival. The four charges, not the cooldown, are the limit. In the final informed runs,
  rain was the main drought and winter action (30 and 37 uses across 20 seeds), and culls
  were the invasion action (64 uses).
- **Failure causes (final, untouched).** Drought: foxes could not catch rabbits (9), rabbits
  eaten out (8), foxes starved for lack of rabbits (1). Bushes were already only 8% full at
  onset (median). Winter: rabbits eaten out (6), foxes could not catch (3), old foxes without
  successors (2), rabbits starved (2), foxes starved for lack of rabbits (1). Invasion:
  foxes could not catch (5), rabbits eaten out (4). Every collapse after onset had at least
  one warning field note in its last ten days, such as `fewfox`, `fcfox`, `overhunt` or
  `foxhungry`.
- **Explanations after a collapse.** The end screen adds "This happened during the
  drought/harsh winter period" for a collapse inside a weather span. It adds "...foxes
  arrive period" for a collapse within 30 days of the arrival. In Endless, weather is
  matched per year, and the one-time arrival is no longer matched in later years. Most
  invasion collapses fall outside that 30-day window, so the end screen does not link
  them to the pack. That matches the finding that the pack has little lasting effect.

### Reproduction

```
node --import tsx scripts/scenario-assay.ts 8300 20 docs/experiments/scenarios-final.json --jobs 2
node --import tsx scripts/scenario-assay.ts 8300 20 docs/experiments/scenarios-final-stable.json --jobs 2 --scenarios stable --conditions untouched
node --import tsx scripts/scenario-summary.ts docs/experiments/scenarios-final.json
```

The tuning reports record their exact commands. Their output paths pointed at a scratch
directory, and the files were then copied here. The practice meadow (seed 5007), the open
meadow and the two-species simulation are unchanged: this work does not touch
`src/sim/sim.ts`, `src/sim/levers.ts` or `src/game/presets.ts`.

## Inherited body size (#10)

Specification: `game-design.md`, "Inherited body size". Raw output:
`experiments/body-size.json` (`scripts/body-assay.ts`, `scripts/validate-balance.ts`).

**Common garden.** One pool of controllers, evolved for 90 days with body size off (seeds
900–903), is given one size gene per line. Each line meets the same neutral-size opponents
in 16 arena worlds (4242–4257): 60 rabbits and 10 foxes, births and ageing off, for 240 hours.
The famine arena has no food and no catching, and the other species is fed each hour. The
30-day breeding arena has births and ageing on and mutation off.

| Rabbits | Small ×0.80 | Neutral | Large ×1.25 |
| --- | --- | --- | --- |
| Distance per hour (speed) | **0.00564** | 0.00501 | 0.00457 |
| Energy burnt per hour, fasting | **0.427** | 0.483 | 0.551 |
| Energy eaten per rabbit-hour | 0.509 | 0.541 | **0.616** |
| Hours from full to starvation | 337 | 372 | **408** |
| Starved in 240 h | 5.0% | 2.4% | **1.8%** |
| Eaten in 240 h | 14.9% | 15.5% | 15.0% |
| Energy to breed / given to each young | **94 / 65** | 117 / 81 | 146 / 101 |
| Births per rabbit-day (30 days) | **0.129** | 0.119 | 0.113 |
| Rabbits alive per founder after 30 days | **3.60** | 3.55 | 3.22 |
| Starved per founder in 30 days (boom and bust) | 12.2 | 9.7 | **8.2** |

| Foxes | Small ×0.80 | Neutral | Large ×1.25 |
| --- | --- | --- | --- |
| Catches per fox-day (240 h) | 0.075 | 0.093 | **0.094** |
| Energy burnt per hour, fasting | **0.232** | 0.258 | 0.295 |
| Hours from full to starvation | 828 | 931 | **1018** |
| Energy to breed / given to each young | **182 / 115** | 228 / 144 | 285 / 180 |
| Births per fox-day (30 days) | 0.044 | 0.047 | 0.047 |
| Foxes alive per founder after 30 days | 3.44 | 3.79 | **3.86** |

Neither size wins everywhere. A large rabbit is 9% slower, burns 14% more energy an hour,
pays 25% more for each young and breeds 5% less often. Its line was 9% smaller after 30
days. In return it refuels 14% faster, lasts 10% longer without food and starves less. A
small rabbit is fast and cheap and breeds most, but it starves most. A small fox catches
19% less. A large fox gains little over a neutral one in these arenas, while paying 14% more
per hour and 25% more per young. The catch-reach effect is covered by the unit tests. In the
arena it was too small to change how many rabbits were eaten (15% in every line), because
controllers decide most encounters. A large rabbit's other predation cost is that it is a
25% larger meal, which feeds foxes rather than harming the rabbit directly.

**Populations (untouched, fresh seeds).**

| Meadow, seeds | Survived, off | Survived, on | Median end hour off / on | Fox peak off / on |
| --- | --- | --- | --- | --- |
| Open, 9400–9419 | 9/20 (45%) | 9/20 (45%) | 6856 / 7125 | 90 / 108 |
| Open, 5000–5049 (validate-balance) | 19/50 (38%) | 23/50 (46%) | 6102 / 7995 | 95 / 107 |
| Vole meadow, 9400–9409 | 3/10 | 3/10 | 4038 / 5649 | 104 / 114 |

Body size did not destabilise the meadows. Survival stays inside the intended 30–50% band,
first extinctions split the same way (Open 9400–9419: rabbits 7, foxes 4 either way), and
no body-on run hit a safety ceiling (one body-off run of 5000–5049 did). Fox peaks are
10–20% higher. Body evolution is therefore **on by default** (`defaultEco().body`). Mean
sizes moved modestly and not in the same direction everywhere. In the Open meadow, living
rabbits went from ×1.01 to ×0.98 by month 9 and foxes from ×1.01 to ×1.08, with foxes ending
larger than their founders in 5 of 9 surviving meadows. In the Vole meadow, voles went from
×1.01 to ×0.93 and rabbits to ×0.93. With 10–20 seeds, these are observations, not a
settled selection result.

**Two-species regression.** `BODY=off node --import tsx scripts/validate-balance.ts 5000 50`
reproduces all 50 rows of the pre-feature engine exactly (19/50 survived) in this runtime.
With body size off, no random numbers are drawn for it and every derived value is exactly the
species value.

**Persistence.** The gene is saved in each genome, and each animal saves its derived size,
max energy, metabolism and top speed. Older saves load at ×1, and their replay frames are
widened from 22 to 23 floats per animal. Frames carry the size in slot 22
(`ANIMAL_SIZE`). The energy fraction in frames is now a share of the animal's own maximum.
The stats row's mean energy still divides by the species maximum.

## Observed ecological varieties (#11)

Specification: `game-design.md`, "Observed ecological varieties". Tests:
`tests/varieties.test.ts`. Long run: `npx tsx scripts/varieties-run.ts stable 3 3` (Open meadow,
default levers, seed 3, Endless, 3 years, one process).

**Known populations (tests).** A single group, with or without correlated traits: no split in 200
samples. Two groups 6 spreads apart (70/30): found, shares and centres recovered. Groups 2
spreads apart, or a 10% minority: not found (the detector's limits). A single drifting group is
never named; two drifting groups keep the same names for 150 days. Temporary splits (15 days; 15
+ 15 with a break; 40 days within one generation) are never named. The end is recorded after 10
days without the split; the same groups returning keep their names; a split in another trait gets
new names. Extinction ends a pair at once. Body-size-only groups are found. Save and resume
reproduce the state exactly; a save cut hours before the naming day forgets it.

**Long run (seed 3, 1,095 days).** Tracking costs 0.91 ms per daily sample against 30.5 ms of
simulation per day (about 3%). Daily records are capped at 366 days (134 KB of state for two
species). A copy restored from a save at day 547 and fed the same frames ended with identical
variety state and journal entries.

**Visible example.** Open meadow, custom seed 3, Endless, default levers: foxes split from day
72 and are named on day 91 (Fox variety 1 53%, variety 2 47%), differing mostly in cruising pace
(0.87 vs 0.23). The pair persists to day 792 (about 45 fox generations); on day 731, variety 2
(72%) against variety 1 (28%): cruising pace 0.17 vs 0.89, threat avoidance -0.02 vs -0.55,
cover seeking 0.31 vs 0.06, body size ×1.21 vs ×1.14. It ends on day 802 when variety 1 falls under 15%, and the
same groups return under the same names on day 831. Rabbits in the same run form and lose three
pairs (named days 53, 284, 1,018), most lasting 1 to 7 months.

