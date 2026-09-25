# Agent playtest brief (issue #3)

You are a PLAYER, not a developer. You play "Coevolution: Meadow Keeper" in a real browser and report what a player experiences.

## Rules that keep this a fair playtest
- Only use what a player sees: screenshots (open them with the Read tool) and visible text (`/text`). Do NOT read the repository, source code, docs, README, or scripts. Do NOT use `/eval` to read game state; use it only to scroll (`window.scrollTo`) if needed.
- Think aloud in your log: what you notice, what you expect, what confuses you, and why you act.
- Record the on-screen date and time (e.g. "14 Nov 03:00") for every intervention and key observation.
- Record failures honestly. You are not trying to make the game look good.

## Browser
Start your own persistent browser driver (one per session, on your assigned port):
`cd <SCRATCH> && (nohup node driver.cjs <PORT> "http://localhost:47601/coevolution_game/<QUERY>" 1440 900 <THEME> > drv-<PORT>.log 2>&1 &)` then wait 5 s.
Commands (curl http://localhost:<PORT>/...):
`/shot?path=<file.png>` · `/text?sel=<css>` (default body; e.g. `aside`, `header`, `main`) · `/click?text=<exact text>` (`&exact=0` for substring) · `/role?role=button&name=<accessible name>` · `/click?x=&y=` (page coordinates, e.g. to click an animal on the meadow canvas) · `/key?k=Space` (also ArrowRight, ArrowUp, Home, End, KeyR) · `/wait?ms=` · `/errors` · `/quit`.
The meadow runs in real time; use `/wait` and speed buttons (text like `1 d/s`, `3 d/s`, `1 wk/s`) or ArrowUp/ArrowDown. Take a screenshot at least every 20 simulated days and at every decision.
Save screenshots to `<SCRATCH>/playtest/s<N>/`.

## Protocol for your session
1. Orientation (≤ 3 minutes of looking): what do you think the goal is, what can you control, what do the panels mean? Note first impressions before reading the Guide (unless your persona reads it first).
2. First attempt: release the animals and play. Watch for trouble (falling food, hungry animals, crashes). Intervene when YOU judge it useful, stating the signal that made you act. Note whether the default speed leaves you time to react.
3. Explain: when the run ends (or the year completes), explain in your own words what happened and why, using only on-screen evidence (deaths by cause, field notes, timeline, Evolution page). Try to identify one inherited adaptation on the Evolution page, and say whether you can tell an inherited tendency from what an animal is doing right now. Inspect at least one animal (click it on the meadow).
4. Deliberate retry: same seed and scenario. Before starting, write the ONE change you will make (a lever setting, an intervention timing, or a different action) and why. Play and record the outcome.
5. Anything else your persona asks for.

## Log format: `<SCRATCH>/playtest/session-<N>.md`
```
# Session <N>: <persona>
- Build: main 3d436cd, URL, viewport, theme
- Seed / scenario / mode / lever changes
## Orientation notes
## Attempt 1
| Date/time on screen | What I saw | What I did / why | Screenshot |
Outcome: survived / collapsed on <date>, final counts, score shown
## Explanation of attempt 1 (my words, with the on-screen evidence)
- Adaptation I could identify (or could not):
- Inherited vs current behaviour (could I tell? how?):
- Collapse cause as I understand it:
## Retry plan (one change + reason)
## Attempt 2 (same table)
Outcome:
## Confusions and friction (each: where, what I expected, what happened, screenshot, severity: blocker/major/minor)
## Did I notice falling food / energy in time? Did the default speed leave time to react?
## Suggestions (small clarity fixes) vs bigger feature ideas (separate)
```
