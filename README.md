# Deepfall

[Play online](https://soulspawnz.github.io/DeepFall/)

A playable, C64-inspired cave puzzle game with the original Boulder Dash I cave campaign, a separate three-cave Deepfall expedition, original C64 sprite geometry in green on black, and the original gameplay sound routines driving reSID. Browser-only runtime; the pinned emulator, cave data, sprite atlas and extracted sound-routine bytes are bundled locally. The full game executable and title tune are not included.

## Play

Serve this directory with any static HTTP server, then open `index.html`. ES modules require HTTP; opening the HTML directly from a file manager is not supported.

From Cortex on this workstation:

```powershell
& 'I:\Nexus\Cortex\run.cmd' -x node 'I:\Nexus\Games\Deepfall\serve.mjs'
```

Then open http://127.0.0.1:8767/. The server is local to this computer and serves only allowlisted public game/audio files, emulator sources, and license notices. Set `DEEPFALL_PORT` to use another port.

Arrows/WASD move. Space + direction digs or collects without moving. P pauses, R restarts, Enter starts/continues. Horizontal pushing requires a clear space beyond the boulder. In Echo mode, Z rewinds up to 16 ticks (1.92 seconds), three times per cave. Rewinds restore the world, score, player, enemy headings and timer. Classic mode disables rewinds and fall warnings. Changing caves or modes starts a fresh cave. Sound is opt-in; mobile direction buttons support held input. Losing window focus pauses automatically.

## Scope and fidelity

The default campaign now contains the 16 original caves A-P and four intermissions, in their original order, with all five original difficulty data sets. Every decoded cell across all 100 cave/difficulty combinations is verified against a separate pinned reference decoder. Primary byte-source verification and a documented missing cave-ID byte in the reference HTML are recorded under `docs/`. See [Original campaign fidelity](docs/ORIGINAL_CAMPAIGN.md).

Original-campaign rules include amoeba growth/conversion, timed shared magic walls, original directional enemy headings, enemy/amoeba explosions, five-stage blasts and chain reactions, delayed birth, scan-order player updates, stationary-to-falling transitions, chance-based horizontal/snap pushing, and original diamond values. Intermissions continue to the next cave after a failed attempt; after Intermission 4, the circuit starts at A with difficulty increased up to 5. The sidebar allows direct cave selection for practice. Classic disables our Echo extension.

The three previous Deepfall caves remain under the other campaign option. The engine retains 120 ms simulation ticks and top-to-bottom, left-to-right object scans. Artwork uses 16px tiles on a 40x22 grid; intermissions display their compact playable region. Timing, presentation, unlimited retries, the C64's hardware-random outcomes, lives, and score accumulation across caves are not hardware-exact reproductions. Exact cave data does not establish cycle-accurate gameplay.

## Reference and REA investigation

- C64 reference: https://c64online.com/c64-games/boulder-dash/
- Official playable classic: https://boulder-dash.com/online-free-game/ (a browser implementation; not proof of identical C64 execution).
- REA: https://github.com/morluto/rea
- Local REA source: `D:\_bin\rea`, package version 6.8.0 when inspected on 2026-10-31.
- `docs/raw-binary.md` documents Ghidra raw NMOS 6502 support, including Windows. It needs a known mapping and an entry at file offset zero; it does not understand C64 disk/tape containers, infer banking, or emulate the machine. The C64's 6510 memory configuration still needs to be accounted for by the analyst.
- Current checkout has neither `dist` nor `node_modules`, no `rea` command was found on PATH, and the active Node is 22.17.0, below the package's 22.23.4 floor for that major. No REA analysis has been executed and no recovered-code fidelity is claimed. No installation or agent configuration was changed.
- Next fidelity pass: identify an exact original build; capture reproducible inputs and outcomes in an emulator; establish an unpacked code mapping and entry; use a ready REA/Ghidra installation for specific unknown rules. Keep observed original behavior separate from implementation choices.

## Verify

```powershell
& 'I:\Nexus\Cortex\run.cmd' -x node --test 'I:\Nexus\Games\Deepfall\test\engine.test.mjs'
```

The engine is DOM-free and tested against gameplay cases, including complete winning input sequences through all three caves. Google Fonts are optional; system fonts work offline. All game assets and logic are local.

## SID audio (2026-10-31)

The placeholder Web Audio oscillators are replaced by Joe Hohertz's JavaScript port of Dag Lem's reSID, pinned to upstream commit `15c861537a6aefdfd242a2692380a537f4c8e66a`. The stable reSID interpolating engine is used, not the upstream experimental reSID-NG/resample-fast variants.

- Default MOS 6581, optional MOS 8580. PAL clock: 985248 Hz. Register changes run at a 50 Hz tracker cadence; reSID clocks individual chip cycles between output samples.
- One emulated SID and three voices total. The separate Deepfall campaign uses a pulse lead, saw bass and triangle arpeggio/noise percussion; its custom effects borrow voice 3 by priority. The original campaign uses the original gameplay voice allocation instead.
- The Deepfall campaign has a custom eight-bar E-minor score, approximately 125 BPM. No original title tune or commercial recording is used.
- Mono output with reSID's model-specific filter available to the sound driver. The Deepfall score uses low-pass filtering; the original driver controls its own registers. No chorus, reverb, stereo widening, sample libraries, or extra oscillators are added. Master volume is output gain.
- `SID SOUND CHECK` auditions the effects in sequence over nine seconds. The register-write/effect counters and output meter come from the live AudioWorklet, not a simulated UI animation.
- Audio requires an explicit click. The AudioWorklet synthesizes on the audio thread, and context suspend handles mute. Pausing the game freezes synthesis. Audio initialization errors are shown, and never silently replaced with generic tones.
- The original campaign uses the published C64 gameplay sound routines and tables. Its three voices handle short effects, movement/explosions, and crack/amoeba/magic-wall effects. Original gameplay has no continuous backing track; music is disabled in this campaign. The separate Deepfall campaign retains the custom score and patches described above. See `docs/ORIGINAL_MEDIA.md` for exact fidelity limits.

Upstream: https://github.com/jhohertz/jsSID. Full unchanged sources, provenance URLs and SHA-256 hashes are in `vendor/jssid/`; the upstream license is `vendor/jssid/LICENSE.md` (GPL-2.0 with documented dependency exceptions). `resid.mjs` is a generated module wrapper with its own change notice. Rebuild it with `node tools/build-sid.mjs` through the Cortex runner; the build verifies source hashes before combining the files. The module declares the legacy `JXG` binding for module strict mode and otherwise preserves upstream source bodies.

Audio engine tests:

```powershell
& 'I:\Nexus\Cortex\run.cmd' -x node --test 'I:\Nexus\Games\Deepfall\test\engine.test.mjs' 'I:\Nexus\Games\Deepfall\test\sid.test.mjs'
```

The game and SID tests include exact sample accounting at 44.1/48/96 kHz, both chip models, each effect with music disabled, effect priority, pause/mute, deterministic sequencing, and the complete sound check. `test/sid-browser.mjs` additionally verifies actual AudioWorklet output, model switching, all nine demo effects, gameplay-driven sound events, music toggle, pause silence, and audio restart in Chromium using an existing caller-supplied Playwright installation. Original-campaign tests add 100 golden map comparisons, original mechanics, a complete winning Cave A input trace, and browser verification of every cave/difficulty selection, intermission continuation, and responsive layout.

Pause has a quiet looping SID theme; death plays the original effect followed by a short descending lament, then falls silent. These two state themes are newly composed, sequenced at PAL rate through the same three-voice reSID chip; the original gameplay tune and effects remain available. MUSIC OFF silences the pause theme and death lament while leaving effects controlled separately. Hidden tabs and SOUND OFF stay silent. A native output gain handles mute independently of worklet messages. Original one-shot effects continue draining after death while inactive-cave ambient sounds and countdown beeps stop. `test/audio-lifecycle.test.mjs` covers both chip models; `test/audio-lifecycle-browser.mjs` measures actual output through pause, mute, chip changes, B's death and restart.

## Recorded play tests

All 100 original stage/difficulty variants received three input-driven automated attempts: 300 total, 26 wins and 274 deaths/time-outs, with zero engine exceptions. These are goal-seeking attempts, not proof of completion of every cave. `docs/playtest-original.json` retains every input and outcome; the CSV gives a compact table. Open **WATCH PLAYTESTS**, then **WATCH AUTOMATED ARCHIVE** to replay those attempts at normal speed. The main button stops playback. Manual cave/restart controls also stop the replay. Sound remains opt-in. The first archive replay is a complete Cave A/1 win.

The library separately preserves the earlier live A/1 and B/1 wins as screenshots and result notes: A finished with 12/12 diamonds, 236 points, 1:56 remaining and two Echo rewinds; B finished with 10/10 diamonds, 282 points, 1:22 remaining and no rewinds. Input recording did not exist during those runs, so they are explicitly marked as results only, without playable replays. C has not been cleared live; the best finished attempt reached 19/24 before death.

Fresh cave attempts now record the inputs actually consumed by the engine, including idle steps, snap-digging and rewind actions. Successful runs are saved in this browser's local storage (latest ten), appear under **Recorded live wins**, and can be replayed or exported as JSON. Pauses are omitted. Clearing browser storage removes these saved recordings; exported files are separate copies. Recordings stay local and are not uploaded. `test/live-replays.test.mjs` verifies exact winning-state reproduction with snap and rewind, persistence validation, and rejection of unsuccessful attempts.

`tools/playtest-original.mjs` regenerates the attempts; `test/playtest-replays.test.mjs` verifies all 300 reproduce their recorded results. `skills/browser-validation/SKILL.md` records the reusable browser-check workflow.

## Learning player

The planner checks an optimistic remaining diamond supply before keeping a search state: collected and loose diamonds, pending diamond blasts, and up to nine diamonds per surviving butterfly. It rejects branches that cannot meet the quota even under that optimistic bound. Amoebas and magic walls are exempt because they can generate additional diamonds. Search also considers approaching butterfly pockets and digging a support followed by retreat and waiting for the physics to settle. Revision 2 leaves existing learned values, partial recordings and replay archives intact; older explored-state fingerprints remain stored but do not suppress expansion under the changed search rules. A returned partial run is the best candidate found within the search budget, so repeated identical results can coexist with searches of different branches.

**Render training in game** is enabled by default. The cave canvas animates the planner's current candidate inputs at 30 steps per second. Search can rewind to a shared route prefix and change branches; the status distinguishes these candidates from the final chosen run. Completed attempts are saved before the chosen run finishes displaying. Your manual cave stays paused and is restored afterward. Use **STOP TRAINING** on the game console to stop, or uncheck the option before training to run in the background. Hidden tabs do not wait for preview animation.

Select a cave and difficulty, then use **TRAIN PLAYER** to run 1–100 simulated attempts. **WATCH NEXT ATTEMPT** learns from one new exploratory attempt and plays it back; **WATCH BEST RUN** replays the shortest win found so far. Exploration controls how often the player tries alternatives. **STOP TRAINING** preserves completed attempts. Changing the selected cave stops its current training batch and loads that cave's separate memory.

Exploration now defaults to **Auto**, with fixed 10% / 25% / 50% overrides. Auto starts at 25% while collecting its first five training results, then reviews progress every five completed attempts. It lowers exploration for consistent escapes, newly improved diamond progress or faster successful runs, and increases it when progress stalls or falls back. Changes are gradual (5–10 percentage points), bounded between 10% and 60%. Only training outcomes count; baseline and evaluation runs cannot inflate success. Fresh results are compared with an earlier block so a single old win does not repeatedly reduce exploration. The displayed percentage is the planner's approximate exploration strength.

The card explains the active percentage and reason, or previews the next attempt's setting when idle. Each new training replay stores the percentage, auto/manual mode and reason; graph inspection shows that setting. The controller persists with the cave's model and import/export without resetting older learning. Manual choice is remembered in this browser and leaves the stored automatic controller intact. `test/adaptive-exploration.test.mjs` checks the adjustment policy, bounds, cadence, evaluation exclusion and serialization; the browser check verifies actual worker-generated records, manual override and cave isolation.

This is tabular, model-based reinforcement learning, not a neural network. The unchanged game engine simulates candidate routes and short escape turns. A table associates cave-state/route pairs with an estimated return. Revision 2 uses discounted per-decision rewards (discount 0.92) so successful moves and later failures receive different credit, instead of assigning almost the same terminal score to every decision. Score is excluded from the state key because it does not change the available moves; time and tick were already excluded. The table retains up to 20,000 decisions, up from 3,000. Later visits use learned values; exploration still samples alternatives. Learning remains specific to saved cave states and can plateau.

Existing models remain loadable, playable and exportable. Enabling the new planner preserves their action values, attempt numbers, history, baseline and best trace. Legacy policy revisions remain available for exact reconstruction of older runs. Planned runs retain their actual inputs and require an exported replay backup if the archive is lost; reconstruction from only a summary is refused.

### Planning and partial memory

Training now combines the existing decision table with bounded best-first physics search. It considers whole routes, snap-digging, repeated original random pushes, push-and-return plans, and short escape sequences around falling rocks. Goal distances respect walls and identify boulder supports that block a route. Intermediate checkpoints before risky moves allow preparation instead of committing to a fatal dig. Several spatially distinct alternatives stay open so one promising dead end cannot monopolize the search.

The player retains up to eight successful or partial input traces, 64 unfinished search branches and 6,000 explored-state fingerprints. Subsequent attempts re-simulate those inputs from the real cave start and continue unexpanded branches. Archived earlier attempts seed this memory automatically. Existing action values supply bounded planning advice; they are never cleared by this upgrade. Exploration controls how often search broadens beyond its highest-ranked branch. Each attempt normally has a 600-node search budget, and hard caves can take longer than the earlier greedy player.

When no escape is saved, **WATCH BEST PROGRESS** plays the best retained partial trace and labels it as a partial run. **WATCH BEST RUN** remains the best known escape. Evaluation does not change learning or explore randomly. If the model knows a winning route, its memory-assisted policy replays and verifies that route from a fresh cave; this establishes reproducibility, rather than claiming a new independent search discovery.

On B/1, a continued saved model reached a real exit after three additional completed attempts: **10/10 diamonds, 314 inputs, 315 points, 1:55 displayed remaining**. The winning search expanded 484 states within a 600-node budget. Inputs were independently replayed through an unchanged game instance and then shown at normal speed in the app. All previous learned decision keys were retained; every pre-existing archived replay was compared after import and remained unchanged. The first two added attempts reached nine diamonds without an exit. This is a B/1 result, not a full-campaign completion claim.

For a bounded continuation from your own exported backups, run `node tools/train-planner.mjs MODEL_JSON REPLAY_JSON OUTPUT_PREFIX 5 600` through the Cortex runner. It writes new model and replay files after every completed attempt, verifies the recorded outcomes and leaves the source backups untouched. Import the two output files with the learning card. Actual local learning backups and input traces are not included in this repository. `test/route-planner.test.mjs` checks memory preservation, partial-branch continuation, serialization and exact winning playback; browser tests exercise the worker and imports.

Those values, recent outcomes, before/after evaluations and the best win persist per campaign/cave/difficulty. Learning memory is bounded, but the separate IndexedDB replay archive retains **every completed training attempt**, baseline and evaluation without automatically trimming old replays. A worker waits for the replay and model to be committed together before continuing. If storage fails, training stops rather than silently dropping recordings. Interrupted attempts that have not completed are not recorded as completed runs. Existing local-storage policies migrate automatically.

The learning card has four keyboard-accessible views: **Overview** for training and progress, **Graphs** for history trends, **Replays** for recorded attempts, and **Data** for imports, exports and recovery. Live status and STOP remain available across views while a job runs. The Overview's **Full learning report** expands detailed statistics. Replay rows use compact PLAY buttons and distinct outcome badges. Use **HIDE CONTENT / SHOW CONTENT** to collapse the entire card (remembered across reloads). Replays show 10, 25, 50 or 100 attempts per page, with newest/oldest/steps/diamond sorting and outcome/type filters. These controls change the view without deleting history. **WATCH ALL REPLAYS** still plays the entire selected cave archive chronologically. Attempt-limit runs advance just like wins and deaths.

**Learning history** graphs use the entire selected cave's replay archive, independently of the recent 100-result model window, table filters or pagination. Switch between diamonds collected (with quota and best-so-far line), rolling training win rate (up to ten recorded runs), and successful escape steps (failures excluded; lower is faster). Amber diamonds show evaluations separately and can be hidden; a hollow point marks the original baseline. Evaluations never inflate the training win rate. Summary statistics show recorded training count, total escapes/rate, first escape and best escape speed. Missing recordings are noted rather than filled with invented data.

Choose all history or the last 25/50/100 training runs. Hover or click a point to inspect its result; the keyboard-accessible **Inspect run** slider also selects records, including evaluations. **PLAY SELECTED RUN** opens its exact saved inputs. Statistics and running-best values are calculated before applying the graph range, so changing the view does not reset earlier achievements. Graphs refresh after saved attempts/imports and reset when the cave changes. They render locally with responsive SVG and require no chart-library download. `test/learning-progress.test.mjs` verifies aggregation and `test/learning-progress-browser.mjs` covers chart modes, range, inspection, replay, complete history, cave isolation and mobile layout.

**EXPORT ALL REPLAYS** downloads all caves' archived inputs, results and provenance; **IMPORT REPLAYS** verifies every trace against the game engine before an atomic import, skips duplicate IDs, and preserves existing models and recordings. **EXPORT LEARNING / IMPORT LEARNING** saves/restores the selected cave's values and best run; imports must match the selected cave/difficulty, and an older model cannot replace a browser model with more completed attempts. JSON imports are limited to 32 MB; AI replay backups accept up to 10,000 runs. Watch Playtests also has **IMPORT LIVE RECORDING** for individual exported live wins, with actual-win verification and duplicate detection. No import or export uploads data. Clearing browser data removes local learning and replays, so keep exported backups.

Older models kept only summaries, route fingerprints and the best trace. **RECOVER EARLIER REPLAYS** deterministically reproduces their history and saves it only if every stored route fingerprint, status, diamond count, score and step count matches. Such rows are marked **Verified reconstruction**. Recovery refuses incomplete or mismatching history; it does not invent missing live keyboard inputs.

The panel distinguishes simulated training and AI playback from live keyboard recordings. Results show route variety, wins, step counts and an untrained/current-policy comparison. The best known win is retained while exploratory attempts can fail. An attempt limit is recorded separately from death or a real exit.

Measured on original A/1 after ten revision-2 training attempts: the evaluated policy improved from **285 to 222 steps**, with **8 training wins and 8 distinct routes**. Save/reload produces the same evaluation. The older revision-1 A result (285 to 164 steps) remains in `docs/learning-evaluation.json`; the revision does not guarantee a better result in every batch. In a 25-attempt B/1 comparison, neither revision escaped: the updated policy's final evaluation still collected 5/10 diamonds. The panel distinguishes a better saved run from the current evaluated policy and explicitly reports when no improvement is measured. `test/learning-player.test.mjs` checks learning and serialization; browser checks cover training, persistence, replay outcomes, stop/cave isolation, import verification, controls and mobile layout.

## Trapped timer

New runs drain the countdown at **10x speed after 1.2 seconds of confirmed entrapment**. The status reads **TRAPPED / TIMER x10**. This changes only the countdown, not physics or animation speed. Standing still, choosing a blocked direction, possible horizontal pushes (including the original random push chance), snap-collectible diamonds and temporary enemy blocks do not count. Confirmation waits for falling/rolling objects and possible amoeba/explosion changes; a steel cage is immediately provable once the grace period passes. Pausing freezes the countdown, and Echo rewind restores the entrapment grace period.

New live and AI recordings tag this timer rule. Older recordings without that tag retain their original normal countdown, including legacy learning reconstruction. The learned state table remains compatible; timer-only counters are excluded from its cave-state key, like remaining time.

## Fullscreen

Click **FULLSCREEN 4:3** or press **F**. The game uses a centered 4:3 stage with black borders to preserve sprite proportions. HUD and controls remain available; **F**, **Esc**, or **EXIT FULLSCREEN** exits. Browsers without native fullscreen use a viewport-filling fallback. Touch controls remain available.

## GitHub Pages

The static site publishes from the root of `main`; `.nojekyll` enables direct static serving. Asset and replay URLs are relative to the game module, so deployment under `/DeepFall/` works. No server, build step, account or API key is required to play. Sound starts after a click and runs locally in the browser.
