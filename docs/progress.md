# Delivery plan and progress

This page tracks the work on the open issues in [roadmap #2](https://github.com/Jack-Coutts/coevolution_game/issues/2) and the UI update. A box is ticked when its pull request has merged into `main`. Every pull request updates its own line.

Last updated: 25 September 2026, 16:40 UTC.

## How the work runs

- One pull request per issue. An agent builds each one in its own worktree.
- Before a merge, independent review lanes check the pull request: a live browser check against `main` and a code audit. Findings are fixed, then the pull request merges.
- The work runs in speed mode at the operator's request:
  - One review pass per pull request, with two lanes and at most one fix round.
  - Nits roll into the next pull request.
  - Experiments use about 20 fresh seeds and one tuning pass. Small samples are labelled as such.
- Work in progress is pushed to `claude/wip-*` branches every 10 minutes, so nothing lives only on one machine.

## Plan and progress

### Foundations

- [x] Run lint, tests and build on every pull request. [#15](https://github.com/Jack-Coutts/coevolution_game/pull/15)
- [x] Light and dark themes, and separate Meadow, Evolution and Guide pages. [#17](https://github.com/Jack-Coutts/coevolution_game/pull/17)
- [x] Give simulation tests a 30 second timeout. [#18](https://github.com/Jack-Coutts/coevolution_game/pull/18)

### Before the third species

- [x] #3 Playtest and clarity fixes. [#19](https://github.com/Jack-Coutts/coevolution_game/pull/19)
- [ ] #4 Balance all eight interventions. Built; the final evaluation is running.
- [x] #5 Intervention budget for Endless mode: one use renews each season, up to four held. [#21](https://github.com/Jack-Coutts/coevolution_game/pull/21)
- [ ] #6 Calibrate Drought, Harsh winter and Fox invasion. In progress.

### A third species

- [ ] #7 Choose the third species. The design record is written: the field vole. It merges after #3 and #4.
- [ ] #8 Add the vole to the simulation and saves. Built; merges after #4 and #7.
- [ ] #9 Make the three-species meadow playable. In progress.

### Bodies and ecological varieties

- [ ] #10 Visible inherited body traits with energy costs. Starts after #9.
- [ ] #11 Track persistent ecological varieties. Starts after #10.
- [ ] #12 Journal with family history and trait changes. Family history and trait-change entries merged in [#22](https://github.com/Jack-Coutts/coevolution_game/pull/22); variety entries arrive with #11.

### Growing brains

- [ ] #13 Test whether memory and growing brains help. Starts after #12. A negative result is a valid outcome.
- [ ] #14 Growing brains in long-running worlds. Only if #13 supports it; otherwise it is deferred with the evidence.

## Known limits

- The #3 playtests were played by agents that saw only the screen, not by human players. `docs/playtest.md` describes what this biases.
- Balance numbers can differ between runtimes. The base meadow gives 18/50 untouched survivors on Node 25 (macOS) and 19/50 on Node 22 (Linux) for the same seeds.
