# Coevolution: Meadow Keeper

A browser game built on the [Coevolution benchmark](https://github.com/Jack-Coutts/coevolution_demo).
Rabbits graze berry bushes and foxes hunt rabbits. Every animal steers with a tiny evolved
brain. Before you press play, you tune the ecosystem's levers within a point budget. The
goal is to keep **both** species alive for a full year: 8,000 hours, from 1 September to
31 July.

- **Energy rules (default).**
  - Animals burn energy every hour: metabolism, vision upkeep, and a speed cost that grows
    with the square of speed.
  - Genes choose each animal's pace, so sprinting trades against endurance.
  - Breeding is gated on energy.
- **Classic benchmark rules (toggle).**
  - The original starvation-by-hours and meals-to-breed rules.
  - A Vitest parity test checks that, with the default levers, these reproduce the Python
    benchmark exactly on seeds 0 to 9.
- **Modes.** Plan (tune, then watch), or Live (4 interventions on a cooldown).
- **Scenarios.** Stable meadow, Drought, Fox invasion and Harsh winter.
- **Also included.** A daily seed, best scores stored locally, and a population timeline
  that doubles as a scrubber. It also shows a trend forecast, boom and bust hints, and a
  plain-language explanation when a run fails.

The time shown in the game is natural time, where 1 tick is 1 hour. The simulation itself
always runs in fixed ticks, and every animal takes exactly one step per tick.

## Run it

Requires Node 20 or newer.

```bash
npm install
npm run dev        # http://localhost:47321
npm test           # parity with the Python benchmark, rules and preset tests
npm run build      # type-check (app, tests, scripts) and production build into dist/
npm run lint
```

**Keys:**

| Key | Action |
| --- | --- |
| <kbd>Space</kbd> | Play or pause |
| <kbd>←</kbd> <kbd>→</kbd> | Back or forward one day (with <kbd>Shift</kbd>: one hour) |
| <kbd>↑</kbd> <kbd>↓</kbd> | Change speed |
| <kbd>Home</kbd> <kbd>End</kbd> | Jump to the start, or back to live |
| <kbd>R</kbd> | Reset the run |

## Layout

| Path | What it is |
| --- | --- |
| `src/sim/` | Pure TypeScript simulation with no DOM: `rng.ts` (CPython-compatible Mersenne Twister), `params.ts`, `sim.ts` (classic and energy rules), `levers.ts` (levers, budget, trade-offs), `scenarios.ts`, `time.ts` (natural-time labels) |
| `src/worker/` | Web Worker that runs the sim and streams frames and per-tick stats |
| `src/game/` | Controller (clock, playback, interventions), run history, insights (hints, forecast, failure explanations), scores, presets |
| `src/render/` | Canvas 2D renderer: procedural top-down rabbits and foxes, meadow, bushes, weather and night |
| `src/components/` | React, Tailwind and shadcn/ui interface |
| `tests/` | Vitest. `parity.test.ts` checks against the Python fixtures; `game.test.ts` covers rules, levers, time and the preset |
| `reference/` | The Python reference (`coevo.py`, `viz.py`) and `make_fixtures.py` |
| `scripts/` | The offline lever sweep and the scenario ranking used to pick the stable preset |
| `docs/game-design.md` | Design doc |

## Parity with the Python benchmark

`reference/coevo.py` is a copy of the benchmark's simulation from
[coevolution_demo](https://github.com/Jack-Coutts/coevolution_demo), using birth-gap reading
2 (`GAP_FROM_OWN_BIRTH = False`). The file `tests/fixtures/python-reference.json` holds its
seeds 0 to 9 results. To regenerate it after the benchmark changes:

```bash
npm run fixtures   # python3 reference/make_fixtures.py (standard library only)
npm test
```

## The stable preset

The **Stable meadow** preset in `src/game/presets.ts` came from an offline sweep under the
energy rules. The sweep was tuned on held-out seeds (100 and up), and seeds 0 to 9 were only
used to report results.

```bash
npm run sweep -- random 0 150 /tmp/r0.jsonl      # random search (run shards in parallel)
npm run pick -- candidates.json 100 20            # stable and scenario survival for each candidate
npm run sweep -- fix preset.json winter 150 out.jsonl   # can a scenario be rescued within budget?
```
