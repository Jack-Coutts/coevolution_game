# Session 1: careful first-time player who likes nature games (reads the Guide first)
- Build: main 3d436cd (as stated in the brief), URL `http://localhost:47601/coevolution_game/` (no query), viewport 1440x900, theme dark
- Seed / scenario / mode / lever changes: I switched to the practice meadow in header settings, "Practice meadow · seed 5007". Scenario was "Open meadow", mode "One year". I changed no levers in either attempt (30/30 pts unspent). No console errors (`/errors` = none).
- Screenshots: `SCRATCH/playtest/s1/`

## Orientation notes
- First look (00-start.png): a green meadow with rabbits, a few foxes and berry bushes. The header counter reads "160 / 6 / 19". The subtitle "keep both species alive for a year" tells me the goal right away. On the right is a "Tuning budget 30/30" panel with slider groups (Populations, Life cycle, Energy, Senses & movement, Food & habitat). Below are a timeline chart and speed buttons (12 h/s ... 1 mo/s). A big "Release the animals" button sits in the middle. The intervention list only says "Available once the run starts", with descriptions of each one.
- Guide (01-guide.png): it was clear and short. Takeaways: rabbits graze bushes and foxes hunt rabbits; each animal steers with a small gene-weighted brain; energy use rises with the square of speed; there are 4 intervention charges shared across 8 options, each followed by a cooldown. Score = 1 point per hour (max 8,760) + 10 per unspent budget point + a calm bonus of 400, minus 100 per intervention. A dashed ring means close to starving and a purple ring means illness. Keys: Space play/pause, arrows, Home/End, R.
- Settings popover (02-settings.png, 03-practice.png): "Today's meadow / Custom seed" toggle, a seed field and a "Practice meadow · seed 5007" button. After I clicked Practice, the popover stayed open and "Custom seed" looked selected. The seed field showed 5007, and the page label changed to "Seed 5007". Escape closed the popover.
- My guess at the goal before playing: stop the foxes from eating out the rabbits and stop the rabbits from stripping the bushes, using as few interventions as possible.

## Attempt 1
Default speed 1 d/s until 23 Feb, then 3 d/s.

| Date/time on screen | What I saw | What I did / why | Screenshot |
|---|---|---|---|
| 1 Sep 08:00 | 160 rabbits / 6 foxes / 19 bushes | Released the animals, no lever changes | 00-start, 03-practice |
| 6 Sep 14:00 | 238r / 6f / 24b. Field note "Holding steady ... bushes 64% full", yet the forecast said ~783 rabbits in 12 days. Deaths: 14 rabbits starved, 7 eaten | Watched. The note "holding steady" and a forecast tripling the rabbits contradicted each other | 10-a1-release |
| 22 Sep 22:00 | 302r / 22f / 33b. Warning "Foxes are up 69% in 10 days ... bust". 457 rabbits starved. The map showed many dark withered bushes | About 11 days passed while I read one screenshot. At 1 d/s the game runs faster than a careful reader | a1-d11 |
| 3 Oct 13:00 | Paused with Space. 270r / 32f / 22b. "Bushes are nearly bare (4%)". Forecast ~248r / ~51f. 784 starved vs 123 eaten | **Plant bushes (#1)**. Signal: bushes nearly bare, and starvation was by far the top cause of death. I picked planting over Rain because the Guide says Rain can trigger a rabbit boom. While paused the bush count stayed at 22, but the Almanac logged "Plant bushes 3 Oct" | a1-pause1, a1-plant |
| 5 Oct 02:00 | 248r / 30f / 25b (new bushes visible) | Resumed | – |
| 13 Oct 15:00 | 173r / 29f / 19b. "Bushes nearly bare (6%)". "Kits are replacing the foxes that die of old age (9 in 10 days)" | The planted bushes seemed to be gone within about a week. Foxes dying of old age after only 6 weeks surprised me | a1-oct14 |
| 31 Oct 07:00 | 123r / 35f / 16b. 1312 starved, 247 eaten | Another 18 days slipped by during my reaction time | a1-oct20 |
| 8 Nov 01:00 | Paused. 100r / 38f. Red note "Only 2.6 rabbits per fox ... may eat the warren out" | **Cull foxes (#2)**. Signal: the rabbits-per-fox warning and the fox forecast still rising. The fox count stayed at 38 while paused and Culled only showed 12 after I resumed (9 Nov 06:00: 97r / 25f) | a1-pause2, a1-cull |
| 16 Nov 06:00 | 115r / 26f / 21b | Watching | a1-nov17 |
| 4 Dec 04:00 | 169r / 25f / 19b (winter) | Watching | a1-loop1 |
| 14 Dec 20:00 | 145r / 33f / 16b. "Bushes nearly bare (7%)". The meadow looked pale and wintry | Kept my 2 remaining charges for a crisis | a1-loop2 |
| 31 Dec 21:00 | 90r / 36f / 12b. "2.5 rabbits per fox" | Considered a cull | a1-loop3 |
| 13 Jan 12:00 | 75r / 35f / 13b. "2.1 rabbits per fox". Forecast ~40r | Decided to cull | a1-loop5 |
| 19 Jan 23:00 | 57r / 33f. "1.7 rabbits per fox" | **Cull foxes (#3)**. My click landed about 6 days after I decided (the Almanac says 20 Jan) | a1-cull2 |
| 26 Jan 14:00 | 78r / 18f. "Old foxes are dying faster than kits replace them". Forecast ~7 foxes | Now I worried that the foxes would die out. 1 charge left | a1-loop6 |
| 9–23 Feb | 132r / 15f to 91r / 16f. "Rabbits up 50% ... food crash likely", then "bushes nearly bare" | Felt stable, so I **switched to 3 d/s** on 23 Feb | a1-loop7–9 |
| 12 Mar – 12 May | 161r/21f, then 196r/30f, 171r/52f, 128r/75f on 20 Apr ("1.7 rabbits per fox"), 149r/76f, 196r/100f | At 3 d/s the 20 Apr warning came and went between my checks. The fox numbers grew steadily | a1-loop10–15 |
| ~24–26 May | Pressed Space to pause. **It did not pause.** The focused "3 d/s" button took the Space press (focus ring on 3 d/s, pause icon still showing). 26 May 00:00: 168r / 129f, "1.3 rabbits per fox" | Tried to pause so I could cull | a1-pause3 |
| 10 Jun 18:00 | When the game finally stopped: 98r / 161f / 29b, "Only 0.6 rabbits per fox", "All interventions used", but Culled still showed 22 | **Cull foxes (#4)**. It came about 2.5 weeks later than I meant. The Almanac logs it on 11 Jun | a1-cull3 |
| 12 Jun 02:00 | 103r / 109f (Culled 76) | I thought it was paused, but it was running. It finished the year while I was writing notes | a1-check |
| 1 Sep 08:00 | "Year complete". 237r / 37f / 48b | – | a1-loop16, a1-live-end |

Replay (scrubbing the graph): 27 Jul 33r / 212f, 4 Aug 18r / 180f, **10 Aug 10r / 145f (lowest point)**, 14 Aug 20r / 113f with bushes 97% full and the note "Foxes are running on empty (mean energy 28%)", 18 Aug 31r / 82f, 22 Aug 48r / 62f (a1-replay-aug). The bush counter read 48 in every replay frame.

**Outcome: survived.** Final 237 rabbits, 37 foxes, 48 bushes. The sidebar showed "Your best on this meadow 9,060" (8,760 + 300 budget + 0 calm). I never saw an end-of-run summary in this attempt. The year ended while I wasn't watching, and my next click, meant for the play button, probably dismissed it. Deaths: rabbits 4382 starved / 2722 eaten / 18 old age; foxes 286 starved / 329 old age / 76 culled.

## Explanation of attempt 1 (my words, with the on-screen evidence)
- What happened: the rabbits boomed immediately (160 to ~300 in 3 weeks) and stripped the bushes. "Bushes nearly bare" showed almost all year, and starvation killed far more rabbits (4382) than foxes did (2722). The foxes rode that boom (6 to 38 by November). Then came a long tug-of-war that I kept resetting with culls. In spring the foxes exploded (up to ~260 in early July on the graph), and rabbits fell to about 10 on 10 Aug. The rabbits survived because the foxes then crashed from hunger ("running on empty 28%") and old age (329 old-age deaths). Meanwhile the bushes, freed from grazing, refilled to 97%, and the rabbits bounced back to 237 in the last three weeks.
- Adaptation I could identify: yes. On the Evolution page (a1-evolution.png), rabbit **Cruising pace** rose from the founders' dashed line (~0.3) to **0.90**, and rabbit **Food seeking** rose from ~0 to **0.62**. In plain terms, the rabbits evolved to move fast and head for food. Fox cruising pace fell from ~0.5 to 0.12 and fox food seeking stayed around 0.10, so the foxes became slow cruisers. Both species ended with a single founder lineage. Highest living generation was 71 for rabbits and 28 for foxes.
- Inherited vs current behaviour: I could only tell them apart because the page says so ("These are tendencies, not an animal's current movement"). The individual I inspected, Rabbit #7213 (gen 61, energy 89%), had genes almost exactly at the population means (food 0.62, threat 0.32, pace 0.91, cover −0.12). Watching an animal move on the meadow tells me nothing about which part is inherited. Fox #720 (gen 21, energy 43%, sight "124% of meadow", pace 0.12) was not visibly doing anything I could tie to its numbers.
- Collapse cause as I understand it: there was no collapse, but it was a near miss. The danger came from the late-spring fox boom (foxes outnumbered rabbits from about June), and my last cull came too late because Space didn't pause. What saved the rabbits was the foxes starving and dying of old age, not anything I did.

## Retry plan (one change + reason)
**Change: do not use Plant bushes on 3 Oct. Keep that charge for a cull at the rabbits-per-fox warning, and act on that warning promptly.** Reason: the planted bushes seemed to vanish within about a week, and the real danger was a fox surge that I answered late. To act promptly I would stay at 1 d/s all year and pause with the on-screen button, not Space. (Same seed 5007 and scenario, no levers. The reset icon kept the seed but also kept the 3 d/s speed, so I set 1 d/s by hand.)

## Attempt 2 (same table)
| Date/time on screen | What I saw | What I did / why | Screenshot |
|---|---|---|---|
| 1 Sep 08:00 | Same meadow (160 / 6 / 19). "Your best on this meadow 9,060" | Set 1 d/s and released | b0-reset |
| 10 Sep 20:00 | 288r / 10f. "Rabbits are up 80% ... bushes only 34% full. A food crash is likely" | Watched (same as attempt 1) | – |
| 15–26 Sep | "Foxes are up 133% / 183% in 10 days". 22 Sep: 314r / 20f / 33b | Watched | b1-20 |
| 2 Oct 14:00 | 285r / 32f / 23b. Almost identical to attempt 1, so the seed is deterministic | Did **not** plant this time | – |
| 12 Oct 10:00–18:00 | "Only 4.8 rabbits per fox" (138r / 29f / 13b), so I paused with the button. By the time of the screenshot the note had flipped back to "Bushes nearly bare (2%)". 144r / 28f, forecast ~62r | **Cull foxes (#1)**, per plan. Almanac: 13 Oct | b1-warn |
| 13 Oct 20:00 | 136r / 16f | – | – |
| 20–29 Oct | "4.5, then 3.4 rabbits per fox". Low of 67r / 20f on 25 Oct. Still on cooldown | Couldn't act. Rabbits recovered on their own from 29 Oct | b2-warn |
| 12–22 Nov | Rabbit rebound: 182r / 17f, peaking at 260r / 23f / 28b on 22 Nov. "Rabbits up 86% while bushes 27% full" | Watched | b3-20 |
| 3 Dec 17:00 | "Only 4.9 rabbits per fox". 165r / 34f / 15b | **Cull foxes (#2)**. Almanac: 4 Dec. 5 Dec: 147r / 24f | b3-warn |
| 13 Dec | 66r / 26f, "2.5 rabbits per fox" | On cooldown. Rabbits recovered on their own from 19 Dec | b4-20 |
| 23 Jan 08:00 | "2.7 rabbits per fox". 122r / 46f / 15b | **Cull foxes (#3)**. Almanac: 24 Jan. 25 Jan: 126r / 34f | b4-40, b4-warn |
| 15 Feb 15:00 | "1.9 rabbits per fox". 95r / 49f / 12b, the worst ratio so far | My plan said to keep the last charge for spring, but this looked like the crisis, so I used **Cull foxes (#4)**. Almanac: 16 Feb | b5-20, b5-warn |
| 23 Feb – 2 Mar | Ratio dipped to 1.5. 63–72 rabbits vs ~40 foxes | No charges left. Watched | – |
| 4–14 Mar | Spring rabbit boom: 94r, then 286r (+292% in 10 days) | Watched | b6-20 |
| 22 Mar – 21 Apr | Foxes climbed steadily: 52, 66, 91, 114. Ratio fell to 1.4–1.5 | Nothing I could do | b6-40, b6-60 |
| May – mid-Jun | Foxes 135, then 199 (31 May), 255 (13 Jun). Rabbits held at 170–220 with bushes full (45–48). "Kits are replacing foxes ... (88 old-age deaths in 10 days)" | Watched. It was odd to see more foxes than rabbits while the rabbits held steady | b6-80, b6-100 |
| 21 Jun 14:00 | 93r / 288f. "Only 0.3 rabbits per fox" | Watched | – |
| 3–23 Jul | Rabbits ~59–70 vs foxes 289, then 264, 210, 128 (lowest ~59 rabbits around 7–16 Jul). "Old foxes are dying faster than kits replace them" | Watched | b6-140 |
| 1–13 Aug | Rabbit boom: 142r, then 633r (13 Aug). Foxes ~90 | Watched | b6-160 |
| 20–31 Aug | Crash: bushes 2%, then "3.3 ... 0.5 rabbits per fox". 31 Aug 08:00: 83r / 155f | Watched, worried the rabbits wouldn't make the last day | b6-180 |
| 1 Sep 08:00 | End modal: "The meadow made it through the year." 3 stars. "72 rabbits and 159 foxes. 8786 rabbits and 979 foxes were born along the way." Survived 1 year, budget +300, calm +0 (4 interventions), **Score 9,060**. NEXT: "Try a harder scenario, or win with more of the budget unspent". Buttons: Watch the replay / Retune and retry | – | b-end |

**Outcome: survived.** 72 rabbits, 159 foxes, 20 bushes. Score 9,060, the same as attempt 1. Deaths: rabbits 5147 starved / 3705 eaten / 22 old age; foxes 303 starved / 474 old age / 49 culled. Lowest rabbit count was ~59 in July, a safer floor than attempt 1's ~10. But the run ended on a falling trend with foxes at 2x the rabbits, so it would likely have collapsed shortly after 1 Sep. My change made the middle of the year safer but did not change the score. Using all four charges early left me helpless during the spring fox boom, which was the same failure mode as attempt 1.

## Confusions and friction (each: where, what I expected, what happened, screenshot, severity)
1. **Space does not pause after clicking a button.** Where: keyboard, after clicking a speed button. Expected Space = play/pause, as the Guide says. What happened: Space activated the focused "3 d/s" button, and the game kept running for ~2.5 weeks of sim time, so my cull came far too late. Screenshot: a1-pause3 (focus ring on 3 d/s, still running). Severity: **major**.
2. **1 d/s is too fast for a careful player to read and react.** Where: the default speed. Expected enough time to read a screenshot and the field notes and then act. What happened: 11–18 days passed between noticing something and acting, several times (22 Sep → 3 Oct, 13 Oct → 31 Oct, 13 Jan → 19 Jan). Screenshots: a1-d11, a1-oct20, a1-cull2. Severity: **major**. I had to rely on pausing, and pausing itself was unreliable (item 1).
3. **Interventions clicked while paused don't show until the game resumes, and the Almanac dates can be off.** Where: Cull foxes / Plant bushes while paused. Expected the counters (foxes, bushes, Culled) to change immediately. What happened: the counts stayed the same while paused. In attempt 2 every cull was logged one day after the paused date (12 Oct → 13 Oct, 3 Dec → 4 Dec, 23 Jan → 24 Jan, 15 Feb → 16 Feb). In attempt 1, the 10 Jun screenshot showed "All interventions used" with Culled still at 22. Screenshots: a1-plant, a1-cull, a1-cull3. Severity: minor to major. I couldn't tell whether my click had worked.
4. **Field notes flicker and sometimes contradict the forecast.** "Holding steady" appeared next to a forecast of ~783 rabbits (6 Sep). The red "rabbits per fox" warning switched to a blue "bushes nearly bare" note within hours (12 Oct), so the most urgent warning disappears. Only one note shows at a time. Screenshots: 10-a1-release, b1-warn. Severity: minor.
5. **I didn't see the end-of-year result in attempt 1.** The year ended while I wasn't watching. Afterwards the sidebar showed only "Your best on this meadow 9,060", and the interventions panel said "Available once the run starts". I had no clear "you won" signal until I saw the modal in attempt 2. Screenshots: a1-loop16 vs b-end. Severity: minor.
6. **The day counter doesn't match the calendar date.** "7 September 04:00 · day 6", "2 October · day 32", "13 August · day 346" vs "12 August · day 346". The day number seems to roll over at 08:00, not midnight. Severity: minor.
7. **Foxes dying of old age within 6 weeks, and a 3-day-old rabbit with 1 offspring.** "Kits are replacing foxes that die of old age" appeared from 13 Oct. Rabbit #7213 was "Age 3 d 10 h, Offspring 1". Neither fit my sense of how lifespans work, and the Guide doesn't give real ages. Screenshot: a1-oct14. Severity: minor (understanding).
8. **The inspector's gene numbers are hard to read.** "Sight range 124% of meadow" for a fox (more than the whole meadow?), "Hidden units 0", and bare numbers like 0.10 with no scale on the card. The Evolution page does explain the −1..1 scale. Screenshot: a1-inspect-fox. Severity: minor.
9. **Plant bushes had no lasting effect I could see.** The count went 22 → 25 → 19 within about 10 days. Screenshot: a1-oct14. Severity: minor. It may simply be how the game works, but I got no feedback.
10. **The replay's bush counter is frozen.** It read 48 on every date I scrubbed to (27 Jul – 22 Aug), while rabbits and foxes changed. Severity: minor.
11. **Evolution journal says "Day 366 · Both species reached year 2" in One-year mode.** Severity: minor wording.
12. **The practice-meadow popover stays open after I choose Practice, and "Custom seed" looks selected.** Screenshot: 03-practice. Severity: minor.
13. **Reset keeps the previous speed (3 d/s), not the default 1 d/s.** Screenshot: b0-reset. Severity: minor.

## Did I notice falling food / energy in time? Did the default speed leave time to react?
- Falling food: yes, the "Bushes are nearly bare" note and the green band on the graph made it obvious from late September. But the only food tools (Rain, Plant) felt weak or risky, so noticing it didn't give me a good move.
- Fox pressure: the red "N rabbits per fox" note was the clearest signal in the game, and I built attempt 2 around it. In attempt 1 at 3 d/s I missed its first appearance (20 Apr).
- Fox energy: I only saw "Foxes are running on empty (28%)" when scrubbing the replay afterwards. I never noticed fox energy live.
- Default speed: **no.** At 1 d/s, reading one screenshot cost me 6–18 simulated days. I needed to pause for every decision, and pausing with Space failed once in a way that cost me the timing of my last cull. With a script watching for warnings (attempt 2) the reaction time was fine. As a human reader, 12 h/s or an auto-pause on red warnings would suit me better.

## Suggestions (small clarity fixes) vs bigger feature ideas (separate)
Small clarity fixes:
- Keep Space as play/pause even when a button has focus, or take focus off speed buttons after a click.
- When an intervention is clicked while paused, show the effect immediately, or add "queued, applies on resume". Log the Almanac entry with the date and time on screen when it was clicked.
- Pin the most urgent (red) field note instead of rotating it out, or show several notes at once.
- Make "Holding steady" agree with the forecast (don't say steady while the forecast is 3x).
- Keep the end-of-year modal (or a persistent "Year complete · Score 9,060" banner) visible if the year ends while the player isn't looking.
- Align "day N" with the calendar date, or label it "day N of the run".
- Explain "Sight range 124% of meadow" and "Hidden units", and show the −1..1 scale on the inspector card.
- Update the bush counter during replay.
- Close the settings popover after "Practice meadow" and make its active state clear.
- Reset should return to 1 d/s, or say that the speed is kept.

Bigger feature ideas:
- Optional auto-pause on red warnings (e.g. "rabbits per fox < 2"), for players who read slowly.
- A small "last intervention effect" readout (e.g. "Planted 4 bushes: 1 still standing after 10 days") so players learn which tools work.
- A season preview or hint that the spring fox boom is coming, so saving a charge feels like a real strategy and not a guess.
- A per-animal "right now" label (e.g. fleeing / grazing / chasing) beside the gene values, so inherited tendency and current behaviour can be compared directly.
