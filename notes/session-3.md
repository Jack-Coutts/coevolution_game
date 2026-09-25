# Session 3: Curious evolution player who wants a long-running world (Endless)
- Build: main 3d436cd, URL `http://localhost:47601/coevolution_game/?seed=7302&scenario=winter`, viewport 1440x900, theme dark (driver port 47803)
- Seed 7302 / scenario Harsh winter / mode Endless (both attempts) / lever changes: attempt 1 none (30/30 pts unspent); attempt 2 Regrowth 9 h -> 3 h (-12 pts, 18 left)
- Screenshots: `SCRATCH/playtest/s3/` (numbered 00-59)
- Console errors (`/errors`) at end of session: none

## Orientation notes
- Header subtitle reads "Meadow Keeper · keep both species alive for a year". There is a "One year" dropdown in the header. When I switched it to "Endless", the subtitle changed to "a world that keeps evolving" and the clock changed from "day 1 of 365" to "day 1 · year 1". That was a nice confirmation that the switch worked (01-endless.png). The mode control is a native `<select>`, so switching was a bit fiddly, but it worked.
- My reading of the goal: keep rabbits and foxes both alive. In Endless, "Score is hours survived, with no year-end bonus". Interventions are "four charges [that] last the whole Endless run", with a cooldown of 16 days 16 hours.
- Controls I can see: a tuning budget (30 pts) with lever groups (Populations, Life cycle, Energy, Senses & movement, Food & habitat), 8 interventions, speed buttons (12 h/s to 1 mo/s), and a scenario picker. The header also has unlabelled icons: sliders, save, folder-open, sun/moon theme, and monitor.
- The scenario banner says "Harsh winter · December to February: little food, and cold burns energy." The timeline shades Dec to Feb as "Harsh winter", so I knew the danger window from the start.
- I opened the Evolution page before releasing the animals (02-evo-pre.png). It has four inherited traits per species (food seeking, threat avoidance, cruising pace, cover seeking), each with "mean line, 80% band, dashed founders". It also has an animal inspector and an empty journal ("milestones will appear"). Founder rabbits start with food seeking at a mean of 0.00. So on average, random-gene rabbits do not steer toward food at all. That made me want to see whether it rises.

## Attempt 1 (Endless, no lever changes)
| Date/time on screen | What I saw | What I did / why | Screenshot |
|---|---|---|---|
| 1 Sep 08:00 | 160 rabbits, 6 foxes, 19 bushes | Switched One year to Endless, released at default 1 d/s | 01-endless.png |
| 10 Sep 13:00 | 245 R / 12 F / 28 bushes. Note "Foxes are up 100% in 10 days". Deaths: rabbits starved 72, eaten 24 | Watched. Starvation already outpaced predation in week 1 | 03-d10.png |
| 28 Sep 08:00 | 326 R / 26 F / 30 bushes. "Bushes are nearly bare (8%)", foxes up 73% | Watched. With only 4 charges for a whole endless run, I didn't want to spend one early | 04-d20.png |
| 6 Oct 14:00 | Paused on the Evolution page: rabbit food seeking 0.00 -> 0.34 in 36 days. Founder lineages 160 -> 16. Rabbit gen 11, fox gen 5. Journal: 3 generation milestones | Inspected Rabbit #405 through the dropdown (see Evolution section) | 05-evo-d28.png, 07-inspector.png |
| 6 Oct 14:00 | Back on the meadow: 235 R / 37 F. Forecast ~160 R, ~66 F | Held for a few more days to check the trend | 10-back.png |
| 11 Oct 16:00 | 124 R / 43 F / 12 bushes. Red note: "Only 2.9 rabbits per fox, and rabbits are falling". Forecast ~39 R. Rabbit #405 had died ("no longer present... Scrub back") | **Cull foxes** (charge 1). Signal: the red note plus a forecast of rabbits collapsing | 11-oct.png, 12-cull.png |
| 11 Oct 16:00 (paused) | Charge dot used and "Recharging" showing, but fox count still 43 and Culled 0 while paused | Resumed. The cull applied on the next tick (13 Oct 04:00: 22 foxes, Culled 14). Almanac logs it as "12 Oct" | 13-postcull.png |
| 21 Oct 01:00 | 61 R / 27 F / 15 bushes. Red note again: 2.3 rabbits per fox. Rabbits starved 1033, eaten 250 | Could not act (cooldown 7 d). Watched | 14-oct21.png |
| 27 Oct 23:00 | 92 R / 27 F / 19 bushes. Rabbits recovering, forecast ~147 | Watched | 15-oct28.png |
| 31 Oct 01:00 to 08:00 (day 60/61) | 92 R / 28 F / 19. "Rabbits are up 51% in 10 days while bushes are only 34% full. A food crash is likely." No winter-specific warning had appeared | **Save** (header disk icon). Toast: "Meadow saved on this device." (See the Save and resume section) | 16-presave.png, 17-save.png |
| 5 Nov 08:00 (day 66) | 96 R / 21 F / 22. Charges 3/4 | Pressed **R**, then **Resume** (folder icon) | 19..21 |
| 31 Oct 08:00 (restored) | World restored to the save point | Clicked a rabbit on the meadow: #1378, gen 12 | 21-resume.png, 23-click-rabbit.png |
| 15 Nov 22:00 | 139 R / 11 F / 28. Yellow note: "Old foxes are dying faster than kits replace them (4 kits and 8 deaths of old age)". Forecast ~4 foxes | **Release foxes** (charge 2). Signal: foxes heading toward extinction just before winter | 25-nov16.png, 26-releasefox.png |
| 25 Nov 00:00 | 199 R / 23 F / 32. "Foxes are up 109% in 10 days" | Watched, cooldown | 27-nov24.png |
| 4 Dec 00:00 (winter) | Meadow turns snowy with the banner "Harsh winter · bushes regrow slowly". 119 R / 34 F / 24. Red note: 3.5 rabbits per fox. Forecast ~71 R, ~61 F | **Cull foxes** (charge 3). Signal: red note plus fox boom | 28-dec3.png |
| 10 Dec 10:00 | **12 R** / 25 F / 18. "Only 12 rabbits left", "rabbits die out by about 22 Dec". Rabbits starved +92 in 6 days, eaten +32 | Could not act: 10 days of cooldown left, 1 charge left | 29-dec11.png |
| 15 Dec 10:00 | 5 rabbits | Still cooling down (5 d left) | 30-dec15.png |
| 19 Dec 14:00 (day 110) | **0 rabbits**, 18 foxes. No end-of-run message. The intervention panel now says "Available once the run starts." Almanac: "Your best on this meadow 2,622" | Pressed play to see what happens. It started a *replay* from 16 Oct with a "Back to live" button | 31-dec20.png, 32-after-collapse-play.png |

Outcome: **collapsed on 19 Dec 14:00 (day 110, year 1): rabbits extinct.** Final counts 0 R / 18 F / 19 bushes. Score shown: "Your best on this meadow 2,622" (hours; the counter said "3 months 19 days survived"). Deaths: rabbits starved 1621, eaten 480, old age 5. Foxes starved 34, old age 22, culled 25. I used 3 of 4 charges.

## Explanation of attempt 1 (my words, with the on-screen evidence)
- **Adaptation I could identify:** rabbit **food seeking** rose from the founders' 0.00 (dashed line) to about 0.34 by day 36, and stayed around 0.35 until the end. The mean line leaves the dashed line in the first ~2 weeks and the band shifts up (05-evo-d28.png, 22-evo-resumed.png). That fits the notes: "Bushes are nearly bare... food caps the warren", and starvation was the #1 rabbit killer, so rabbits that steer to food leave more kits. On the fox side, **cover seeking** rose from about -0.06 to about +0.24 over Nov to Dec (33-evo-end.png). It rose again in attempt 2, where I never released foxes, so I think it is real selection and not just the 3 foxes I added. But I can't say *why* cover seeking helps a fox. Rabbit threat avoidance also climbed from about -0.1 to about +0.2 in the last two weeks, while foxes were booming. That looks like a response to predation, but it rests on very few surviving rabbits.
- **Inherited vs current behaviour:** yes, partly. The page says so explicitly: "Inherited responses measured in the same test situations. These are tendencies, not an animal's current movement." The inspector shows an animal's inherited numbers (e.g. #1378: food seeking 0.23, threat avoidance 0.23) next to its current state (energy 13%, health "Well"). But nothing tells me what the animal is *doing* right now (fleeing, eating, wandering), so I could only compare "tendency" with "state", not with "behaviour". I had to guess current behaviour by watching the dot move.
- **Collapse cause as I understand it:** in autumn, rabbits boomed and ate the bushes bare, and most deaths were starvation. Foxes then boomed on the crowded rabbits (twice, in October and in late November). Winter began 1 Dec with a fox boom already underway (34 foxes). Cold plus slow regrowth caused a starvation wave (rabbits went from 119 to 12 in 6 days, mostly starved), and foxes finished the rest. My 4 Dec cull came too late to matter, and the 16-day cooldown meant I couldn't respond to the crash itself. On reflection, the October cull might have been better saved for winter.

## Retry plan (one change + reason)
- **Mode: Endless again.** My persona wants a long-running world, and keeping the same mode lets me compare survival time (hours) directly with attempt 1.
- **One change: Food & habitat -> Regrowth 9 h -> 3 h** (the minimum, -12 pts; the explanation line updated to "Each bush regrows 8 berries a day"). Reason: starvation caused 75% of rabbit deaths (1621 of 2106), and the final crash was mostly starvation. In Endless, unspent points don't seem to count for anything ("Score is hours survived, with no year-end bonus"), so spending them costs me nothing. Interventions: same reactive rule as attempt 1 (cull when foxes boom or the red rabbits-per-fox note appears).

## Attempt 2 (Endless, Regrowth 3 h)
| Date/time on screen | What I saw | What I did / why | Screenshot |
|---|---|---|---|
| 10 Sep 15:00 | 262 R / 10 F / 28 | Watched | 40-a2-d10.png |
| 20 Sep 11:00 | **611** R / 14 F / 35. Green note: "Holding steady: 611 rabbits and 14 foxes", but the forecast says ~1833 rabbits | Confused: "holding steady" while tripling? | 41-a2-d20.png |
| 26 Sep to 12 Oct | Rabbits pinned at exactly **800**. New line under Deaths: "The performance safety limit has restricted births. This run is not valid for balance comparisons." The note keeps saying "Holding steady: 800 rabbits" | Continued. Switched to 3 d/s, but the sim ran at roughly 1 d/s with 800+ animals | 42..45 |
| 20 Oct 08:00 | 701 R / 33 F; rabbits falling as foxes rise | Watched | 47-a2.png |
| 17 Nov 12:00 | 386 R / **102 F** / 29. "Foxes are up 59%". Forecast 182 F | **Cull foxes** (charge 1). Signal: fox boom heading into winter | 51-a2.png |
| 28 Nov 03:00 | 478 R / 131 F. Foxes up 93% | Cooldown | 53-a2.png |
| 4 Dec 12:00 (winter) | 296 R / 174 F. Red note: "Only 1.7 rabbits per fox" | **Cull foxes** (charge 2), same trigger as the 4 Dec cull in attempt 1 | 55-a2.png, 56-a2-cull2.png |
| 15 Dec 17:00 | 10 R / 142 F. "Rabbits die out by about 28 Dec" | Cooldown (4 d) | 57-a2.png |
| 16 Dec 20:00 (day 107) | **0 rabbits**, 135 foxes | Run over | 58-a2.png |

Outcome: **collapsed 16 Dec 20:00 (day 107), 3 days earlier than attempt 1.** Final 0 R / 135 F / 21 bushes. Deaths: rabbits starved 4493, eaten 1730. Foxes culled 92. Score about 3 months 16 days (best stays 2,622). The run was flagged "not valid for balance comparisons" because of the performance limit. More food made a bigger rabbit boom, which fed a much bigger fox boom (174). The foxes ate the warren out in winter. Here, predation rather than starvation finished it (eaten +250 in the last 12 days). The one change backfired: food was not the only limit. It just moved the bottleneck to foxes.

## Save and resume
- **Save** (header disk icon): one click, toast "Meadow saved on this device." Saved state: 31 Oct 08:00, day 61, 92 R / 28 F / 19 bushes, 3 of 4 charges, "Ready" (cooldown finished), deaths R 1082/282/3, F 9/9/14, almanac "Cull foxes 12 Oct".
- I played on to 5 Nov 08:00 (96 R / 21 F / 22) and pressed **R**. The world went back to the 1 Sep setup screen immediately, **with no confirmation**, even though I was 66 days into an Endless run. Endless mode stayed selected.
- **Resume** (folder icon): restored exactly **31 Oct 08:00, day 61 · year 1, 92 / 28 / 19, 3 charges (dots), "Ready. There is a 16 days 16 hours cooldown"**, identical deaths table, almanac "You · Cull foxes · 12 Oct", setup locked with 30 pts unspent. Everything I checked matched the save (21-resume.png).
- The Evolution page after resume kept the **full** trait history from Day 1 to Day 61, the generation and lineage counts (rabbit gen 13, 4 founder lineages), and all 3 journal entries (22-evo-resumed.png).
- **Surprising:**
  1. **The meadow population graph after resume only starts at 16 Oct** (the x-axis reads "16 Oct, Nov, Dec..."). The whole September boom/bust and my October cull are gone from the chart, and the y-axis rescaled from 389 to 110. The Evolution page still has Day 1 onward, so the two views disagree about how much history exists. When the run later ended and I pressed play, the replay also started from 16 Oct.
  2. After I clicked Save, the button kept keyboard focus, so pressing **Space re-saved** (a second toast) instead of pausing or playing. I thought I was running the sim for 5 days, but nothing moved (18-postsave-play.png). This is easy to trip over if you save and then hit Space to continue.
  3. The selected-animal card (Rabbit #405) disappeared after resume. That is fine, since it was dead anyway.
  4. The header icons have no visible labels. I had to guess that the disk was Save and the folder was Resume.

## Evolution page: what I could and could not understand
**Could understand**
- The header strip: highest living generation, founder lineages, animals now. Watching founder lineages fall from 160 to 16 (day 36) to 4 (day 61) to 1, while generations climbed to 20+, told a clear story: a few families take over fast.
- The trait charts. The mean line against the dashed founder line is an effective way to see "has this changed since the start?". The rabbit food-seeking rise was obvious at a glance. The one-line legend and the note "tendencies, not an animal's current movement" helped me not over-read it.
- The journal disclaimer "Trait changes alone do not prove an advantage" is honest, and I appreciated it.
- The inspector works from both places. Clicking an animal on the meadow selects it on the Evolution page too, and a ring marks it on the meadow. When the animal dies, the card says "no longer present at the displayed time. Scrub back to inspect its earlier life."

**Could not understand / could not do**
- **Following a family is not possible.** The inspector shows "Parent #351" and "Lineage #101" as plain text, and clicking them does nothing. Both parents I checked (#351 for #405, #1311 for #1378) were already dead and missing from the dropdown. There is no list of offspring (only a count, e.g. "Offspring 4"), no siblings, and no "show everyone in lineage #101". So I could see one hop up at most, and could not go back down. For a curious player this was the most disappointing part.
- The dropdown is a flat list of ~100 to 240 unordered IDs ("Rabbit #257, #371..."), with no generation, lineage, or age next to the name. I had no reason to pick one rabbit over another.
- "**Hidden units 0**" in the inspector is unexplained jargon. "Sight range 20% of meadow" was the same for every animal I looked at.
- An animal at "Energy 10%" showed "Health Well". I wasn't sure whether low energy is a problem or not.
- The **journal only records generation milestones** plus "One founding rabbit/fox lineage remains". It never mentioned the trait changes the charts show (e.g. "rabbits now seek food much more than founders"). It never recorded the **rabbit extinction** itself (day 110 and day 107), which is the biggest evolutionary event of the run. In attempt 2 it didn't even record the lineage bottleneck.
- **After extinction, the rabbit trait charts drop to 0.00** and the headline values read 0.00 (e.g. cruising pace 0.00 = "resting"). That reads as if the traits changed, when really there are no rabbits. A gap or an "extinct" label would be clearer (33-evo-end.png, 59-a2-evo.png).
- I couldn't tell cause from coincidence for fox cover seeking (rising about 0.25 in both runs). Was it selection, or just the one surviving lineage's value? Showing which lineage dominates would help.
- The Evolution page has its own play/pause strip. Once I'd opened it I wasn't always sure whether the meadow was running.

## Confusions and friction
1. **R resets an Endless run with no confirmation.** Where: keyboard R on the meadow at 5 Nov (day 66). Expected: a confirm, or at least an undo. What happened: an immediate wipe to 1 Sep. Screenshot 20-reset.png. Severity: **major** for Endless players (it was recoverable only because I had saved).
2. **The meadow graph loses history on resume** (starts 16 Oct instead of 1 Sep), while the Evolution page keeps it. The replay also starts at 16 Oct. Screenshot 21-resume.png. Severity: **major** for a "long-running world".
3. **Space re-triggers Save after clicking Save** (focus stays on the button), instead of play/pause. Screenshot 18-postsave-play.png. Severity: minor.
4. **A player lever triggers the performance cap.** Regrowth at 3 h (only 12 of 30 pts) pinned rabbits at 800 and showed "The performance safety limit has restricted births. This run is not valid for balance comparisons." I got no warning at the lever. The speed control (3 d/s) also ran at roughly 1 d/s at that size. Screenshot 43-a2.png. Severity: **major**. A legitimate tuning choice makes the run "invalid".
5. **"Holding steady" field note while rabbits triple** (611 with a forecast of ~1833) or are pinned at the cap. Screenshot 41-a2-d20.png. Severity: minor (misleading).
6. **No end-of-run message on extinction in Endless.** Only the 0 counter changed. The intervention panel oddly switched to "Available once the run starts." Pressing play then silently started a replay. Screenshots 31-dec20.png, 32-after-collapse-play.png. Severity: major (I wasn't sure the run had ended, or what my score was, except via "Your best on this meadow").
7. **The cull doesn't apply while paused.** The charge was spent and the cooldown started, but the fox count stayed 43 and Culled stayed 0 until I resumed. The almanac then dates it "12 Oct", while I clicked at 11 Oct 16:00. Screenshot 12-cull.png. Severity: minor.
8. **Budget text is unclear in Endless.** "Unspent points add to your score if both species survive" sits next to "Score is hours survived, with no year-end bonus". Do unspent points matter in Endless or not? Severity: minor.
9. Header icons (save, resume, sliders) have no visible labels. Severity: minor.
10. Field note "Kits are replacing the foxes that die of old age (11 in the last 10 days)" appeared when the deaths table showed only 5 old-age fox deaths in total. It's unclear whether 11 means kits or deaths. Severity: minor.

## Did I notice falling food / energy in time? Did the default speed leave time to react?
- Falling food: yes. "Bushes are nearly bare (8%)" appeared by 28 Sep, and the deaths table made starvation obvious. But the game gave me nothing to *do* about it in time without spending one of only 4 lifetime charges. I never saw a specific "winter is coming" warning before 1 Dec. The only winter cue was the pre-shaded timeline band and the scenario banner.
- The winter crash (119 to 12 rabbits in 6 days, 4 to 10 Dec) was faster than the 16-day cooldown. At 1 d/s I could *see* it, but I couldn't respond, because I'd used my charge on 4 Dec. Default speed is fine for watching. With 800+ animals it was actually slower than chosen.
- Rabbit energy: I only saw energy via the inspector (10%, 13% on the two rabbits I checked). There is no population-level energy readout, so I couldn't tell that winter starvation was coming until it hit.

## Suggestions (small clarity fixes)
- Confirm before R-reset when a run is in progress (at least in Endless), or offer "Undo reset".
- Keep the full population history in the save, or say "history before 16 Oct not saved".
- Return focus to the meadow after Save/Resume, so Space keeps meaning play/pause. Add labels or tooltips to the header icons.
- Show an explicit "Rabbits died out on 19 Dec, day 110. Score 2,622 h" end card in Endless, and log extinction in the Evolution journal.
- Blank (not 0.00) trait lines after a species goes extinct.
- Don't say "Holding steady" when the forecast is +200%, or when births are being capped.
- Warn at the lever (or in the tuning budget) when a setting is likely to hit the performance limit.
- Explain "Hidden units" or hide it. Label the budget line so it's clear whether unspent points count in Endless.
- A winter heads-up field note ~2 weeks before 1 Dec ("Winter in 14 days: food will stop regrowing").

## Bigger feature ideas (separate)
- **Family explorer:** make Parent and Lineage clickable (even for dead animals, via history), list offspring, and add "highlight this lineage on the meadow". Show a lineage share chart (which founder families dominate over time), so I can see *who* drove a trait shift.
- Journal entries for trait shifts ("Rabbit food seeking is now +0.3 above founders") and bottlenecks, with a link to the matching point on the chart.
- A "what is it doing now" state on the inspector (seeking food / fleeing / hiding / resting), shown next to its inherited tendencies. That would directly answer "inherited vs current".
- In Endless, allow charges to regenerate slowly (e.g. one per season). Four charges for an unlimited run means every intervention feels like a mistake unless it's in winter.
