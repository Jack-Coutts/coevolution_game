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

The [paired intervention experiment](experiments/interventions.json) starts from those same
50 seeds and permits four actions, with the game's 400-hour cooldown. After hour 240, a
simple fixed policy culls foxes when rabbits are scarce and foxes numerous, feeds very few
hungry foxes, supplies rain when rabbits are hungry, or releases rabbits when very scarce.
Exact priorities, thresholds and action times are in the script and raw report.

Raw outcomes: **18/50 untouched vs 23/50 with interventions**. The policy rescued nine
otherwise failing seeds and spoiled four otherwise successful ones. One paired seed (5041)
is excluded from balance evidence because its intervention run hit the rabbit safeguard;
both versions failed. Among the remaining **49 valid pairs: 18 survived untouched, 23 with
interventions**. This suggests useful agency; it is not evidence of optimal play or a
statistically established general improvement. The new illness and planting choices have
mechanical tests, but this policy does not establish their strategic balance.

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

Final local checks: **33 tests passed** across five test files; TypeScript and the production
build passed; lint completed with no errors and four existing component-export warnings.
Vite reports a roughly 507 kB main JavaScript chunk (162 kB gzip), just above its advisory
500 kB threshold. The reusable browser validation page was also checked through worker
startup and progress reporting; the recorded full browser batch used the same simulation
loop and parameters.

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
  the rest came 42–246 days later. We did not retune it in this pass. A larger pack or an
  earlier arrival is the obvious next step and needs its own tuning and fresh seeds.

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
