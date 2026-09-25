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
No claim is made that larger or growing brains outperform the default.

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
