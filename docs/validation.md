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
