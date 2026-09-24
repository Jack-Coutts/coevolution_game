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
