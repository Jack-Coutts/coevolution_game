# Coevolution: Meadow Keeper

A browser game about an evolving ecosystem. Rabbits graze berry bushes and foxes hunt rabbits. Every animal steers with a tiny evolved
brain. Before you press play, you tune the ecosystem's levers within a point budget. The
goal is to keep **both** species alive for a full year: 8,000 hours, from 1 September to
31 July.

- **Energy rules.**
  - Animals burn energy every hour: metabolism, vision upkeep, and a speed cost that grows
    with the square of speed.
  - Genes choose each animal's pace, so sprinting trades against endurance.
  - Breeding is gated on energy.
- **One flow.** Tune the levers within a budget, release the animals, then use up to 4
  interventions on a cooldown. A full year with fewer interventions scores higher.
- **Scenarios.** Stable meadow, Drought, Fox invasion and Harsh winter.
- **Also included.** A daily seed and shareable seed links (in the settings menu), best scores stored locally, and a population timeline
  that doubles as a scrubber. It also shows a trend forecast, boom and bust hints, and a
  plain-language explanation when a run fails.

The time shown in the game is natural time, where 1 tick is 1 hour. The simulation itself
always runs in fixed ticks, and every animal takes exactly one step per tick.

## Run it

Requires Node 20 or newer.

```bash
npm install
npm run dev        # http://localhost:47321
npm test           # RNG, reproducibility, energy and birth rules, preset
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

## Deploy

The site is served from GitHub Pages at https://jack-coutts.github.io/coevolution_game/.

- **Base path.** Production builds use the base `/coevolution_game/`, and dev keeps `/`. The
  Web Worker, fonts and favicon all resolve under that base.
- **Workflow.** `.github/workflows/deploy.yml` runs on every push to `main`, or manually with
  **Run workflow**. It runs `npm ci`, `npm test` and `npm run build`, then publishes `dist/`.
- **One-time setup.** In the repo, set **Settings → Pages → Source** to **GitHub Actions**.

To check a production build locally:

```bash
npm run build && npx vite preview --base /coevolution_game/   # http://localhost:47322/coevolution_game/
```

## Layout

| Path | What it is |
| --- | --- |
| `src/sim/` | Pure TypeScript simulation with no DOM: `rng.ts` (seeded Mersenne Twister), `params.ts`, `sim.ts` (energy rules), `levers.ts` (levers, budget, trade-offs), `scenarios.ts`, `time.ts` (natural-time labels) |
| `src/worker/` | Web Worker that runs the sim and streams frames and per-tick stats |
| `src/game/` | Controller (clock, playback, interventions), run history, insights (hints, forecast, failure explanations), scores, presets |
| `src/render/` | Canvas 2D renderer: procedural top-down rabbits and foxes, meadow, bushes, weather and night |
| `src/components/` | React, Tailwind and shadcn/ui interface |
| `tests/` | Vitest: `rng.test.ts`, and `game.test.ts` for reproducibility, energy and birth rules, levers, time and the preset |
| `scripts/` | The offline lever sweep and the scenario ranking used to pick the stable preset |
| `docs/game-design.md` | Design doc |

## The stable preset

The **Stable meadow** preset in `src/game/presets.ts` came from an offline sweep. The sweep was tuned on held-out seeds (100 and up), and seeds 0 to 9 were only
used to report results.

```bash
npm run sweep -- random 0 150 /tmp/r0.jsonl      # random search (run shards in parallel)
npm run pick -- candidates.json 100 20            # stable and scenario survival for each candidate
npm run sweep -- fix preset.json winter 150 out.jsonl   # can a scenario be rescued within budget?
```
