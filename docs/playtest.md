# Playtest: can players spot trouble, understand evolution and improve a run?

This note records the playtest for issue #3. It covers the procedure, the three sessions, what they show, the fixes made and the findings left for other issues.

## Who played

These were agent-played sessions. Three Claude agents each played the game in a real Chromium browser and saw only the screen: screenshots and visible text. They did not read the code, the docs or the game state. They were not human players.

That biases the results in known ways:

- **Reading speed.** An agent reads a screenshot and writes notes slowly, so 6 to 18 simulated days often passed between a signal and a click. A human reads faster, but at 1 d/s a 10-day warning still lasts only 10 seconds.
- **Clicking precision.** Agents click by exact text or coordinates. They do not miss buttons, but a scripted click can land on whatever is under the pointer, such as the result dialog's backdrop.
- **No gaming habits.** Agents bring no expectations from other games, such as pausing before acting or looking for a hidden cap. They also do not get bored or tired.
- **A loaded machine.** Other agents shared the machine, so playback speeds were slower than on a normal computer.

Treat the findings as a list of things that can confuse a player, not as measured rates.

## Procedure

Each agent followed the same brief:

1. **Orientation.** Look for up to three minutes. Say what the goal is, what can be controlled and what the panels mean.
2. **First attempt.** Release the animals and play. Intervene when the player judges it useful, and name the signal that prompted it. Note whether the default speed leaves time to react.
3. **Explain.** When the run ends, explain what happened using only on-screen evidence: deaths by cause, field notes, the timeline and the Evolution page. Find one inherited adaptation. Say whether an inherited tendency can be told apart from what an animal is doing now. Inspect at least one animal.
4. **Deliberate retry.** Same seed and scenario. Before starting, write down one change and the reason for it. Play and record the outcome.
5. **Persona extras**, such as save and resume.

Every intervention and key observation was logged with the on-screen date and time, with a screenshot at least every 20 simulated days. The build was main at 3d436cd, at 1440 by 900.

## Sessions

### Session 1: careful newcomer who reads the Guide first

- **Settings:** practice meadow, seed 5007, Open meadow, One year, dark theme. No lever changes.
- **Attempt 1 interventions:** Plant bushes 3 Oct; Cull foxes 8 Nov, 19 Jan and 10 Jun. The Almanac logged each one a day later than the paused date.
- **Outcome:** survived, 237 rabbits and 37 foxes, score 9,060. The lowest point was 10 rabbits against 145 foxes on 10 Aug.
- **Confusion:** Space did not pause after a click on "3 d/s", so the last cull came about 2.5 weeks late. Culls did not show while paused. "Holding steady" appeared beside a forecast of about 783 rabbits. The red rabbits-per-fox note vanished within hours. The end of year result was missed and could not be found again.
- **Retry change:** skip Plant bushes and keep every charge for culls at the red rabbits-per-fox note. Reason: planted bushes seemed gone within a week, and the fox surge was the real danger.
- **Retry outcome:** culls on 12 Oct, 3 Dec, 23 Jan and 15 Feb. Survived with 72 rabbits and 159 foxes, score 9,060 again. The low point was safer (about 59 rabbits), but no charges were left for the spring fox boom.

### Session 2: impatient strategy player who skips the Guide

- **Settings:** seed 7301, Open meadow, One year, light theme. Levers: starting rabbits 160 to 120, starting bushes 19 to 23, sprouting 2 to 3 per day (22 of 30 points left).
- **Attempt 1 interventions:** Plant bushes on 14 Oct (decided on 23 Sep, landed three weeks later at 3 d/s), Cull foxes 1 Nov and 18 Dec, Plant bushes 5 Jan. Then "All interventions used" with 7.5 months left.
- **Outcome:** survived, 192 rabbits and 166 foxes, score 8,980 (budget +220, calm +0).
- **Confusion:** the four-use cap was only shown as four dots. The sim ran on while the player decided. "1 wk/s" delivered about 1.5 to 2 days a second. The result dialog closed on a stray click and could not be reopened. Nothing explained the 8,760 base of the score.
- **Retry change:** same levers, but use all four charges as culls, fired at the red rabbits-per-fox note. Reason: the food crashes fixed themselves, and the spring fox boom nearly ended attempt 1 when no charges were left.
- **Retry outcome:** culls on 23 Oct, 20 Dec, 22 Mar and 10 Apr. Survived with 103 rabbits and 157 foxes, but rabbits fell to 17 on 28 Jun. The score was not seen. The retry did not help: a cull bought about two weeks.

### Session 3: curious evolution player in Endless

- **Settings:** seed 7302, Harsh winter, Endless, dark theme. Attempt 1 had no lever changes. Attempt 2 set regrowth from 9 h to 3 h.
- **Attempt 1 interventions:** Cull foxes 11 Oct (logged 12 Oct), Release foxes 15 Nov, Cull foxes 4 Dec. The player saved on 31 Oct, pressed R by accident on 5 Nov (no confirmation), and resumed.
- **Outcome:** rabbits died out on 19 Dec, day 110. Best score 2,622 hours.
- **Confusion:** no end message was seen. R wiped a 66-day run at once. After resume the graph started at 16 Oct while the Evolution page started at Day 1. Space re-pressed Save. Trait charts dropped to 0.00 after the extinction. "Hidden units 0" was unexplained. The journal never recorded the extinction.
- **Retry change:** regrowth 9 h to 3 h. Reason: starvation caused 75% of rabbit deaths.
- **Retry outcome:** collapsed on 16 Dec, three days earlier. More food fed a bigger rabbit boom (capped at 800 by the performance limit), then a bigger fox boom that ate the warren in winter.

## Findings

**Can players spot trouble?** Mostly yes. All three read "Bushes are nearly bare" and the red "N rabbits per fox" note correctly, and sessions 1 and 2 built their retries around the red note. They failed to act in time. The sim kept running while they read, Space sometimes pressed a button instead of pausing, and a click while paused did nothing visible. Fox energy and winter starvation were not noticed until too late.

**Can players identify an adaptation?** Yes, in all three sessions. Session 1 saw rabbit cruising pace rise from about 0.3 to 0.90 and food seeking from about 0 to 0.62. Session 2 saw rabbit threat avoidance rise from about 0 to 0.69 and tied it to 4,812 rabbits eaten. Session 3 saw rabbit food seeking rise from 0.00 to about 0.34 and tied it to starvation. All three could tell inherited tendency from current behaviour only because the Evolution page says so in words. None could see a tendency in how an animal moved.

**Can players explain a collapse?** Yes. Session 3 explained both winter collapses from deaths by cause and the notes: a fox boom going into winter, then starvation and predation. Sessions 1 and 2 explained near misses the same way. Two misreadings remained. Session 1 read foxes dying of old age at six weeks as odd. Session 2 could not interpret fox threat avoidance, since nothing hunts foxes.

**Can players choose a change with a stated reason?** Yes, all three did. None improved the outcome. Sessions 1 and 2 moved all charges to culls and ran out before the spring fox boom. Session 3 added food, which fed a larger boom. The reasons were sound readings of the screen, but the game gave no feedback on what an intervention achieved. That points at intervention balance (#4) more than clarity.

## Fixes made in this branch

| Finding | Fix |
| --- | --- |
| Space pressed a clicked button (speed, Save) instead of pausing | Space stays play/pause while a control keeps focus from a mouse click; a keyboard-focused button still takes Space |
| Interventions landed hours to days after the click and did nothing while paused | The action applies at the hour on screen: the worker rewinds to that hour from a checkpoint, applies it and steps one hour, so the effect shows at once. Same seed, settings and action hours reproduce the run (tested). The Almanac shows the hour |
| The four-use cap was only four dots | "3 of 4 uses left" beside the dots; the setup preview says 4 uses per run with the cooldown |
| The result could be dismissed and never seen again; the score base was unexplained | "Show result" in the transport and side panel after the end; the dialog spells out hours plus budget and calm bonuses, and says when bonuses do not apply |
| No end message in Endless | Not reproduced: the dialog appeared when rabbits died out in an Endless Harsh winter run (fix-D-endless-result.png). The likely cause was a click that dismissed it; it can now be reopened |
| R wiped a long run with no warning | Reset asks first once the run is past seven days; planning resets stay instant |
| Graph after resume started at the replay window | The graph keeps the whole run; the timeline marks "Replay kept from 15 Sep" and scrubbing stops there |
| Trait values read 0.00 after an extinction | "none alive", no empty samples on the chart, dashes on the tiles |
| "Hidden units 0", "Health: Well" at 9% energy, unexplained gene numbers | Hidden row shown only when above 0 (as "Extra neurons"); "Illness: None"; hover notes with each scale |
| "Holding steady" beside a tripling forecast; red note vanished on a blip | Steady only when the forecast is flat, otherwise a trend note; danger notes stay for 48 hours marked "(N h ago)"; most urgent first |
| No time to react | The meadow pauses once when a new red note appears; a switch turns it off, kept per device, on by default |
| Speed label promised more than it delivered | The shown rate is measured; below 80% of the label it reads "running at 3 d/s" |
| Journal missed the extinction and said "year 2" in a one-year run | "Rabbits died out" entry; a finished year reads "Both species lasted the full year" |
| Budget text unclear in Endless; settings stayed open after Practice | Endless says unspent points add nothing; the popover closes |
| Stale notes after extinction ("Only 0.0 rabbits per fox", "Only 1 rabbits") | Not carried once a species is gone; singular fixed |

The speed measurement, in Node on the shared 4-core machine: one simulated hour takes about 2.1 to 2.6 ms with 400 rabbits and 150 foxes, and 4.5 to 4.8 ms with 800 rabbits. That is at most about 370 to 450 hours a second, or 210 with 800 rabbits, before the worker packs frames and the page draws them. 1 wk/s (168) is reachable; 2 wk/s is marginal and 1 mo/s (720) is not on a crowded meadow. In the preview build, 1 mo/s with about 330 animals ran at about 11 d/s.

## Rejected

- **Day counter rolls over at 08:00.** "Day N of 365" counts 24-hour days from the release at 08:00, which is correct.
- **Reset keeps the speed.** Speed is a player preference and the button shows it.
- **Replay bush counter frozen at 48.** 48 is the bush cap; with few rabbits the meadow sat at it.
- **Clicking the graph enters replay.** It is labelled, and "Back to live" returns.
- **Header icons have no visible labels.** They have tooltips and accessible names. A visible label is a layout change for later.

## Out of scope, with the issue they map to

- **#4 Interventions balance.** Culls buy about two weeks before foxes rebound. Planted bushes seemed gone within a week. Four charges cannot answer the spring fox boom. No feedback shows what an intervention achieved ("planted 4 bushes, 1 still standing"). Field notes do not say whether a food crash is normal cycling or dangerous.
- **#5 Endless budget.** Four charges for a run with no end make every use feel like a mistake; a slow recharge (for example one per season) was requested.
- **#6 Scenario calibration.** Regrowth at 3 h (12 of 30 points) pins rabbits at the 800 performance cap and marks the run invalid, with no warning at the lever. The Harsh winter crash (119 to 12 rabbits in 6 days) is faster than the 16-day cooldown. Fox and rabbit lifespans read as short to players.
- **#12 Journal and family history.** Clickable parent and lineage, an offspring list, "show this lineage on the meadow", a lineage share chart, journal entries for trait shifts, a sorted animal picker, and a "what it is doing now" label in the inspector.

Proposed new issues:

1. **Save at the displayed hour.** Save stores the worker's state, which can run up to a few days ahead of the screen at 1 mo/s, so the clock jumps forward on save. Reuse the intervention rewind so a save captures the hour on screen.
2. **Rename the "Evolution" lever group.** It shares a name with the Evolution page, and a click on the text opened the page. The label lives in src/sim/levers.ts.
3. **Season heads-up note.** Add a field note about two weeks before a scenario's hard season ("Winter in 14 days: bushes will regrow slowly"), so a player can save a charge for it.
