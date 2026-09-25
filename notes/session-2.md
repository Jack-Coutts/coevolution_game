# Session 2: Impatient strategy-game player (skips the Guide, tweaks levers on run 1, plays fast)
- Build: main 3d436cd (as stated in brief; not verified from the UI), URL `http://localhost:47601/coevolution_game/?seed=7301`, viewport 1440x900, theme light, driver port 47802
- Seed 7301 / scenario "Open meadow" / mode "One year" (both were already selected on load)
- Lever changes (3, same for both attempts): Starting rabbits 160 -> 120 (+4 pts refund), Starting bushes 19 -> 23 (-8 pts), Sprouting 2.00 -> 3.00/day (-4 pts). Budget 30 -> 22 left.
  - Why: the opening screen shows 160 rabbits on 19 bushes. That looked like too many mouths for the food, so I cut rabbits (which refunds points) and spent the refund plus a bit more on food. I left the foxes alone because 6 seemed fine. I kept most of the budget because the panel says unspent points add to the score.
- Guide: never opened. I never felt stuck enough. The things I was confused about (the intervention cap, what counts as score) were things I only found out about too late, not things I got stuck on.
- Screenshots: `playtest/s2/`

## Orientation notes
- Header: "Meadow Keeper · keep both species alive for a year". The goal is clear from the title alone. The top-right counters (rabbit / fox / red dot 19) are readable. I guessed the red dot is bushes because it matched "Starting bushes 19".
- Right panel: "Tuning budget 30/30", then lever groups: Populations, Life cycle, Energy, Senses & movement, Food & habitat, Evolution. Each shows a live summary line ("Breeds at 117 energy...", "On a full tank: resting 19 d 6 h..."). As a strategy player I liked that, but it's a wall of numbers. I skimmed only Populations and Food.
- The slider cost badges ("-8", "+4 pts") show up next to each lever and in the group header. That's good, instant feedback.
- Friction: the lever group "Evolution" has the same name as the "Evolution" tab. My first click on the text "Evolution" opened the Evolution page, not the lever group (02-evo-click.png). Minor.
- Changing Starting rabbits re-scattered the animals on the preview meadow (the fox positions changed). That's fine, just noticed.
- The interventions list is visible before release, with descriptions. It says "A full year with no interventions earns +400, and each one used lowers that bonus by 100." It does NOT say there is a hard cap of 4 interventions per run. The four dots in the Interventions header turned out to be that cap. I didn't read them as such.

## Attempt 1
| Date/time on screen | What I saw | What I did / why | Screenshot |
|---|---|---|---|
| 1 Sep 08:00 | 120 R / 6 F / 23 bushes | Released, set 3 d/s right away (persona) | 04-levers.png |
| 23 Sep 00:00 | 433 R / 21 F / 43 bushes. Field notes: "Rabbits are up 49% in 10 days while bushes are only 8% full. A food crash is likely", "Foxes are up 91% in 10 days... boom usually followed by a bust". Deaths: 469 starved already | Decided to Plant bushes (food crash warning) | a1-05.png |
| 14 Oct (Almanac date) | By the time my click landed it was 15 Oct 05:00 (191 R / 49 F). The sim kept running at 3 d/s for about 3 weeks while I read the screenshot and decided. The intervention was applied 3 weeks after the signal. | Plant bushes (effectively too late; the rabbit crash had already happened on its own) | (text only) |
| 1 Nov 08:00 | 216 R / 71 F. Fox line climbing steadily, forecast ~84 foxes. Paused (Space) to decide | Cull foxes. Signal: fox curve still rising, 3 rabbits per fox. Afterwards the header count still showed 71 while paused; it only updated after resuming | a1-06.png |
| 10 Nov 12:00 | 234 R / 51 F; Culled 23. Looks steadier | Switched to 1 wk/s. Space would not resume because the focused "1 wk/s" button took the key press (see Confusions) | a1-07.png, tmp.png |
| 20 Nov 21:00 | 366 R / 65 F. "Rabbits are up 49%... bushes 12% full. A food crash is likely" | Nothing. I wanted to save interventions | a1-08.png |
| 18 Dec 08:00 | 96 R / 89 F. "Only 1.1 rabbits per fox, and rabbits are falling. The foxes may eat the warren out." | Cull foxes (the clearest danger signal of the run) | a1-10.png |
| 4 Jan 12:00 | 230 R / 51 F / 28 bushes, winter. "Rabbits are up 117% in 10 days while bushes are only 27% full." Culled total 52 | Plant bushes: winter, few bushes, a rabbit boom on the way | a1-11.png |
| 18 Jan 01:00 | 252 R / 53 F. Panel now says "All interventions used." | Surprise: I did not know there was a cap of 4. I'm now a spectator for about 7.5 months | a1-12.png |
| 16 Feb 13:00 | 215 R / 71 F. Food crash warning again | none possible | a1-13.png |
| 16 Mar 08:00 | 286 R / 112 F / 47 bushes, spring. Forecast ~425 R / ~136 F. The fox line is rising steadily all spring | none possible | a1-15.png |
| 6 Apr 18:00 | 257 R / 158 F | none possible | a1-17.png |
| 9 May 09:00 | 243 R / 216 F | none possible | a1-20.png |
| 7 Jun 09:00 | 190 R / 244 F. Foxes now outnumber rabbits | none possible | a1-22.png |
| 27 Jun 16:00 | 92 R / 236 F. "Only 0.4 rabbits per fox... may eat the warren out." "Old foxes are dying faster than kits replace them (44 kits and 48 deaths)" | none possible. I expected a rabbit extinction | a1-23.png |
| 18 Jul 07:00 | 177 R / 179 F. Rabbits bounced back as old foxes died off | none | a1-24.png |
| 31 Jul 10:00 | 295 R / 190 F | none | a1-25.png |
| 29 Aug 21:00 | 159 R / 183 F / 48 bushes | none | a1-27.png |
| 1 Sep 08:00 (year complete) | End modal: 3 stars, "The meadow made it through the year." 192 R / 166 F. "11011 rabbits and 1230 foxes were born". Survived 1 year, Budget bonus +220, Calm bonus +0 (4 interventions), **Score 8,980**, "New best for this scenario and seed!" | Clicked away (my next scripted click hit the graph and dropped me into replay at 3 Nov; "Back to live" got me out) | a1-28.png, a1-29.png |

Speed note: at "1 wk/s" the on-screen clock actually moved only about 1.5 to 2 days per real second with 300-400 animals on screen. At "3 d/s" early in the run, with fewer animals, it seemed to move at or above the label. The speed label is not what I got once the meadow was crowded.

**Outcome: survived.** 192 rabbits / 166 foxes at 1 Sep, score 8,980 (budget +220, calm +0).

## Explanation of attempt 1 (my words, with the on-screen evidence)
- What happened: the rabbits boomed immediately (120 to 433 in 3 weeks) and then starved en masse. "Deaths by cause": 469 starved by 23 Sep and 1,501 by 1 Nov, while only 346 had been eaten. The foxes grew in the background on that boom. Through autumn and winter the pattern was a boom-bust saw-tooth: the rabbit booms were capped by food ("Bushes are nearly bare... food caps the warren"), and the fox booms were capped by my two culls. After my last intervention (5 Jan) the foxes grew without a check from about 50 to 244 by June. Rabbits fell to 92 (0.4 per fox). The foxes then died of old age in bulk (final: 818 fox old-age deaths vs 200 starved), the pressure eased, and the rabbits rebounded. Both species were alive at the bell, but foxes were close to rabbits in number (166 vs 192).
- Adaptation I could identify: **Rabbit "Threat avoidance"** rose from about 0 (the dashed founder line) to 0.69, with a narrow band by the end. Rabbits also got faster ("Cruising pace" 0.85, above the founders) and more food-seeking (0.46). I read this as selection for fleeing: 4,812 rabbits were eaten, so jumpy rabbits survived to breed. Foxes: "Threat avoidance" fell to -0.53. I don't know what a "threat" is for a fox, so I can't interpret that.
- Inherited vs current behaviour: the Evolution page says it plainly: "These are tendencies, not an animal's current movement." The inspector for Fox #1206 showed its gene values (Food seeking 0.13, Threat avoidance -0.58, Cruising pace 0.60, Cover seeking -0.32) plus current state (Energy 68%, Health Well, Age 12 d 12 h). So the inspector shows the inherited numbers, and the meadow shows what the animal is doing now. I could tell them apart only because of that sentence. On the meadow itself you can't see a gene, only movement. The numbers in the inspector have no scale or explanation there. In attempt 2, Rabbit #10350 showed "Energy 9%" and "Health Well" together, which read as contradictory to me.
- Collapse cause as I understand it: no collapse. The near-collapse (June, 0.4 rabbits per fox) was caused by the fox boom in spring. I had used up all 4 interventions before winter ended, so I had nothing left when it mattered. The real lesson: the first planting (reacting to the 23 Sep food-crash note) was wasted. The rabbit crash resolved on its own, and the click landed 3 weeks late anyway.
- Also: both species ended with "Founder lineages: 1". Only one founder line of each survived.

## Retry plan (one change + reason)
**One change: same levers, but never plant bushes. Use all 4 interventions only as "Cull foxes", fired when the field note "Only X rabbits per fox, and rabbits are falling" appears.**
Reason: in attempt 1 the food-crash warnings resolved themselves (rabbits starve back down, then regrow). The fox boom in spring was what nearly ended the run, and I had no interventions left for it. Saving the interventions for fox pressure should keep the fox line down through spring. I also switched to pausing (via the Play/Pause button, not Space) at every decision so the click lands at the signal's date.

## Attempt 2
Speed 1 wk/s from release.

| Date/time on screen | What I saw | What I did / why | Screenshot |
|---|---|---|---|
| 1 Sep 08:00 | Restart (the circular-arrow button) kept my 3 levers and the seed. Good | Released at 1 wk/s | a2-01.png |
| 22 Sep 01:00 | 442 R / 21 F / 47 bushes, "Rabbits are up 67%..." (same boom as attempt 1, so it's deterministic for the seed) | nothing (by plan) | a2-02.png |
| 7 Oct 09:00 | 197 R / 40 F, "Only 4.9 rabbits per fox, and rabbits are falling" | nothing yet; 4.9 seemed OK | a2-03.png |
| 23 Oct 12:00 | 165 R / 59 F, "Only 2.8 rabbits per fox, and rabbits are falling" | **Cull #1** | a2-04.png |
| 18 Nov 11:00 | 388 R / 41 F, rabbit boom, food-crash note | nothing (by plan) | a2-05.png |
| 2 Dec 07:00 | 299 R / 53 F, "Bushes are nearly bare (11%)" | nothing | a2-06.png |
| 20 Dec 13:00 | 150 R / 71 F, "Only 2.1 rabbits per fox" | **Cull #2** | a2-07.png |
| 7 Jan 14:00 | 232 R / 44 F | nothing | a2-08.png |
| 5 Feb 13:00 | 83 R / 54 F, "Only 1.5 rabbits per fox" | **Missed**: I was running several steps in a row and didn't stop to react. The rabbits recovered on their own anyway | a2-09.png |
| 23 Feb 16:00 | 256 R / 66 F | nothing | a2-10.png |
| 3 Mar 22:00 | 424 R / 87 F | nothing | a2-11.png |
| 10 Mar 23:00 | 437 R / 100 F, "Bushes are nearly bare (5%)" | nothing | a2-12.png |
| 22 Mar 22:00 | 234 R / 135 F, "Only 1.7 rabbits per fox... may eat the warren out" | **Cull #3** | a2-13.png |
| 6 Apr 00:00 | 191 R / 119 F. The cull took about 45 foxes, but they were back to 119 within 2 weeks. The field note turned red. "Kits are replacing the foxes that die of old age (39 in the last 10 days)" | Waited for the 16 d 16 h cooldown | a2-14.png |
| 10 Apr 10:00 | 165 R / 127 F | **Cull #4** (last) | a2-15.png |
| 25 Apr 00:00 | 343 R / 114 F | none possible | a2-16.png |
| 16 May 04:00 | 187 R / 209 F | none possible | a2-18.png |
| 8 Jun 22:00 | 61 R / 212 F | none possible | a2-19.png |
| 28 Jun 22:00 | **17 R** / 109 F. I thought the rabbits were done for | none possible | a2-20.png |
| 17 Jul 04:00 | 219 R / 64 F: a huge rebound after the foxes starved or aged out. Forecast "~1584" rabbits | none | a2-21.png |
| 28 Jul 01:00 | 591 R / 79 F, "Rabbits are up 150%... food crash is likely" | none | a2-23.png |
| 21 Aug 22:00 | 158 R / 136 F | none | a2-25.png |
| 1 Sep 08:00 (year complete) | 103 R / 157 F / 33 bushes. Field note "Only 0.7 rabbits per fox". Culled total 130 | My scripted Pause click dismissed the end modal before I saw it (a2-26 is after dismissal). I found no way to reopen the result summary. "Your best on this meadow" stayed at 8,980, so attempt 2 scored at most that | a2-26.png |

**Outcome: survived** (both species alive at 1 Sep), 103 rabbits / 157 foxes. Score not seen (the modal was dismissed, and it's not recoverable from the UI); it was not a new best, so it was at most 8,980. Budget +220 and calm +0 were the same as attempt 1, so the difference comes from whatever else the score counts (I can't tell what; nothing on screen explains the ~8,760 base).

Comparison: the retry plan did NOT help. Culls buy about 2 weeks; foxes rebound fast ("Kits are replacing..."), and 4 culls can't hold down a spring fox boom. The rabbits came closer to extinction than in attempt 1 (17 vs 92 at the low point), and the run ended with more foxes than rabbits. My takeaway: interventions don't fix this seed. The levers are the real tool (e.g. fewer starting foxes, or weaker fox breeding). The single-lever-change rule stopped me testing that.

Evolution page after attempt 2 (a2-29-evo.png): Rabbit Threat avoidance 0.46 (vs 0.69 in attempt 1), Food seeking 0.60, Cruising 0.75. Foxes again had Threat avoidance -0.51. Founder lineages 1 / 1 again.

## Confusions and friction
1. **Hidden cap of 4 interventions** (Interventions panel). I expected: the cooldown ("16 days 16 hours cooldown between interventions") is the only limit, plus the calm-bonus penalty. What happened: after the 4th, "All interventions used." with about 7.5 months left. The only hint was four small dots in the panel header. Screenshot a1-12.png / a1-15.png. **Severity: major.** It changed my whole strategy after the fact.
2. **Real-time sim keeps running while you decide** (3 d/s). I acted on a warning at 23 Sep; the click landed ~14 Oct (Almanac). The Almanac shows the actual date, which is honest, but a fast player loses weeks. Nothing suggests pausing before an intervention. a1-05.png vs Almanac in a1-06.png. **Severity: major** at 3 d/s and above (partly my agent latency, but a human reading the field notes has the same problem at 1 wk/s).
3. **Space doesn't toggle play after clicking a speed button.** The focused speed button takes the Space key, so the meadow stays paused. "or press Space" is advertised on the release screen. tmp.png. **Severity: minor.**
4. **Speed labels are not honest when crowded.** "1 wk/s" gave about 1.5 to 2 days/s with 300-400 animals. **Severity: minor** (it has a performance cause, but the label promises a speed you don't get).
5. **End-of-run modal can't be reopened.** Any click outside closes it, and I found no "last result" in the sidebar, only "Your best on this meadow". Attempt 2's score is lost. a2-26.png. **Severity: major** for a score-chasing player.
6. **What makes up the score?** 8,980 = Budget +220 + Calm +0 + ~8,760 unexplained. Nothing explains the base (days survived? births? final populations?). **Severity: minor-to-major** for a strategy player; I couldn't tell what to optimize.
7. **Header count didn't update right after Cull while paused** (still 71 foxes immediately after culling at 1 Nov; updated after resume). **Severity: minor**; I briefly thought the cull failed.
8. **"Evolution" is both a tab and a lever group name.** Clicking the text went to the tab. 02-evo-click.png. **Severity: minor.**
9. **Inspector numbers without meaning.** "Threat avoidance -0.58" on a fox: threat from what? "Hidden units 0": what's that? "Energy 9%" next to "Health Well" on Rabbit #10350 looked contradictory. "Lineage #44" while the Evolution page says "Founder lineages 1": is #44 a lineage ID or a count? **Severity: minor.**
10. **After the run ends, the Interventions panel says "Available once the run starts."** That's wrong wording for a finished run. a1-30-live.png. **Severity: minor.**
11. **Clicking the graph jumps into replay** (it says so in small print, "Click or drag the graph to replay"). I hit it by accident near the play button and landed in 3 Nov replay; "Back to live" rescued me. **Severity: minor.**

## Did I notice falling food / energy in time? Did the default speed leave time to react?
- Food: yes. The field notes ("Rabbits are up X% while bushes are only Y% full. A food crash is likely", "Bushes are nearly bare") are clear and early. But acting on them was wrong in hindsight: the food crash fixes itself by starving rabbits. The notes don't tell me whether a crash is dangerous or just normal cycling.
- Fox pressure: the "Only X rabbits per fox, and rabbits are falling" note is the useful one. It turns red when it's serious (a2-14.png). I noticed it in time every time I was paused; I missed one (5 Feb, attempt 2) while running steps back-to-back.
- Individual energy: I never looked at individual energy until inspecting after the run. At this speed you can't track individual animals.
- Speed: I never used the default 1 d/s (persona). At 3 d/s and 1 wk/s there was NOT enough time to react without pausing. A 10-day warning passes in 1.5 to 3 seconds. Pausing via the Play/Pause button worked well.

## Suggestions (small clarity fixes)
- State the intervention cap in words ("4 per run, 3 left") next to the dots, before release as well.
- Pause automatically (or offer "pause on red field note") when a warning appears at speeds of 3 d/s and above; or apply the intervention at the date the player clicked (at least show "applied 15 Oct").
- Show a score breakdown that includes the base (what earned the ~8,760), and keep a "Last run" result card in the sidebar that reopens the end modal.
- Don't let speed buttons keep focus for Space (or make Space global for play/pause).
- Show "measured" vs "requested" speed when the sim can't keep up (e.g. "1 wk/s (running at ~2 d/s)").
- Tooltips on inspector traits (what a fox's "threat" is, what "Hidden units" means, why Health is Well at 9% energy).
- Rename the "Evolution" lever group (e.g. "Mutation & inheritance") so it isn't confused with the tab.
- Field notes could say whether a food crash is self-correcting or dangerous ("rabbits will starve back down; foxes unaffected").
- Fix the "Available once the run starts." text after the year is complete.

## Bigger feature ideas (separate)
- A "plan ahead" or queued intervention ("cull when ratio < 2") for fast players, since real-time reaction at 1 wk/s is hard.
- A post-run coach: "Your fox line grew unchecked from 5 Jan to June after your last intervention; consider fewer starting foxes or slower fox breeding." That would push players toward the levers, which I suspect are the real lever (pun intended) on this seed.
- Let a retry change a lever and an intervention plan at once, or show a side-by-side of two runs' graphs on the same seed.
