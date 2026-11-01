# Learning and planning

This describes the current player. The earlier [learning-player plan](learning-player-plan.md) and [planner plan](learning-planner-plan.md) are historical implementation records, not current performance guarantees.

## Training, evaluation, and playback

Training uses the unchanged game physics in a Web Worker. Each completed attempt updates the model and saves its actual consumed inputs. Search normally expands up to 600 nodes; exhausting that budget is recorded as **attempt limit**, separately from death or escape.

After a batch, evaluation uses the current model without updating its learning or enabling exploratory breadth selection. Its result is separate from the best training run. A remembered winning input trace can seed evaluation: reproducing that exit is not a new independent discovery.

**WATCH NEXT ATTEMPT** trains once and then plays the recording. **WATCH BEST RUN** plays the shortest retained escape; **WATCH BEST PROGRESS** plays the best retained partial when no escape exists. Meeting the diamond quota alone is never a win.

## Learned memory and search

The player combines tabular outcome learning with bounded best-first search. The table associates cave states and decisions with estimated returns. Current planned runs credit consumed moves with discounted rewards (discount 0.97); the earlier revision-2 route policy uses 0.92 and remains available for legacy compatibility. Learned values provide bounded advice to search rather than replacing physics simulation.

Planner revision 4 also learns continuous multipliers for collection, available supply, distance, speed, mobility, preparation, amoeba conversion, and push opportunities. The first completed priority trial measures the reference weights (all 1×). Subsequent trials perturb two to four multipliers around the best measured profile, within 0.2–5× per multiplier. The perturbation range widens during a plateau; every fifth trial rechecks the retained profile. This is bounded evolutionary policy search, not a neural network or a menu of fixed strategy presets.

Credit comes from the completed attempt's engine state: an actual exit dominates, followed by quota progress, available/pending diamonds, distance to the next goal, and input length, with a death penalty. The quality formula and feasibility checks remain fixed so a profile cannot redefine success or permit a provably insufficient diamond supply. The multipliers affect route proposals, search ranking, and short escape ranking. Reused partials, random seed, search budget, and unfinished branches also influence outcomes; a higher observed quality is not a controlled proof that one particular multiplier caused the improvement.

The model retains the best measured profile and the last 32 priority observations. Evaluation uses that profile without updating it; baseline and evaluation records never count as priority-learning trials. **Planning priorities** in Overview shows the current/retained multipliers. New replay records include their exact profile, weights, trial kind, and measured quality; older recordings remain unchanged. Old action values, partial traces, Auto state, and attempt numbers remain available. Explored-state namespaces include the weight profile so a change in ranking can revisit states expanded under a different policy.

Keys omit score, remaining time, tick count, and trapped-timer counters. The actual world still simulates those quantities, enemy headings, falling objects, and random pushes. Excluding time from a key allows experience to transfer across waits; timed outcomes still matter.

| Model memory | Limit |
| --- | ---: |
| Learned decision values | 20,000 for policy revision 2; 3,000 for legacy revision 1 |
| Recent result summaries | 100 |
| Successful or partial input traces | 8 |
| Unfinished search input traces | 64 |
| Explored-state fingerprints | 6,000 |

The replay archive is separate and is not trimmed to these limits. Learning is specific to campaign, cave, and difficulty. It is not a neural network or a guaranteed solver for unseen caves.

Search considers routes to gems and exits, snap-digging, support removal, repeated chance-based pushes, push-and-return moves, and short escapes. Dig-and-retreat options allow falling rocks and butterfly explosions to settle. Intermediate checkpoints let later attempts branch before a damaging choice. Saved inputs are always re-simulated from the real cave start; dead snapshots are never resumed as alive.

Planner revision 2 rejects branches whose optimistic remaining diamond supply is below the quota. It counts collected and loose diamonds, pending diamond blasts, and up to nine diamonds per surviving butterfly. Amoebas and magic walls are exempt because they can generate more diamonds. A sufficient bound does not prove that the supply is reachable.

New expansion rules use a new explored-state fingerprint namespace. Old fingerprints remain within bounded memory but do not suppress the changed options. Existing learned values, attempt numbers, baseline results, and archived inputs stay compatible.

Planner revision 3 adds generation setup proposals. It prioritizes clearing a blocked magic-wall outlet before releasing a rock above that wall, skips feed proposals once activation time is exhausted, and distinguishes an unused wall from an expired one in search keys. Around amoeba it considers access digs, retreat, and longer waits; a confirmed conversion into diamonds receives planning credit, while conversion into rocks does not. These are bounded search hints, not assumed diamonds: collection and escapes must occur in the engine. They do not guarantee containment or successful completion of the original G/H caves.

A partial result is the best candidate found within the search budget. Different searches can return the same incumbent, producing identical diamond and step counts. More route variety or higher exploration does not by itself establish progress.

## Auto exploration

Auto begins at 25%, reviews every five completed training attempts, and stays between 10% and 60%. Adjustments are 5–10 percentage points. It considers escape consistency, new diamond progress, and successful-run speed; stalled or regressing results can increase exploration.

Only training outcomes count. Fresh results are compared with a preceding block so an older win cannot repeatedly lower exploration. The percentage controls how often search broadens beyond its highest-ranked branch; it is not a literal random-move probability or a success estimate.

The card shows the active setting or previews the next attempt when idle. New training recordings include the applied percentage, mode, and reason. Auto state persists per cave. Fixed 10%, 25%, or 50% overrides leave the stored Auto controller intact; the selected mode is remembered in this browser.

## Live rendering and branch arrows

**Render training in game** animates inputs at 30 engine steps per second. **Show search rewinds** defaults off: the canvas waits during planning, then plays each completed attempt continuously from its start. When enabled, it shows changing search candidates, including rewinds to shared prefixes. The preference persists locally, is disabled during a job, and affects display only; it neither changes learning nor spends or grants Echo gameplay rewinds. A separate game instance preserves the paused manual cave. Stop or completion restores it. Preview audio is muted; hidden tabs do not block training while waiting for animation.

**SHOW BRANCHES** toggles lime lines for the most recent 60 consumed inputs. When search rewinds are enabled, it also shows cyan arrows for up to 12 tested local continuations and dashed red forecasts that ended in death. Continuations start at the candidate endpoint, outlined in cyan, which may be ahead of the animated player. Each draws at most 32 actual movement segments.

Lines use simulated player positions, including blocked moves and failed pushes. These are sampled options, not all open branches or promises of an exit. Only the recent route remains on the final chosen run. Normal keyboard play and saved replays do not show the overlay.

## Graphs and replay controls

The keyboard-accessible **Overview / Graphs / Replays / Data** tabs share live status and Stop. Expand **Full learning report** for details. **HIDE CONTENT** collapses the card and remembers that preference.

Graphs read the full selected cave archive independently of the model's 100-result window, filters, and pagination. Views show diamonds with quota and running best, rolling training win rate over up to ten runs, and successful escape steps. Failures are excluded from escape speed. Baseline and evaluation markers remain separate from training.

Choose all history or the last 25/50/100 training runs. Hover, click, or use **Inspect run** to inspect a result and exploration metadata; **PLAY SELECTED RUN** replays it. Changing graph range does not reset earlier running-best achievements.

Replays offer 10/25/50/100 rows per page, sorting, and outcome/type filters. **WATCH ALL REPLAYS** plays the selected cave archive chronologically, including failures and attempt-limit runs. View controls do not delete history.

## Storage, backups, and recovery

Completed AI training attempts, baselines, and evaluations live in IndexedDB. Model and replay records are committed together before the worker continues. Storage errors stop training. Stop preserves completed records; interrupted unfinished searches are not completed attempts. Existing local-storage policies migrate automatically.

Under **Data**, keep both backups:

| Controls | Contents and import behavior |
| --- | --- |
| EXPORT LEARNING / IMPORT LEARNING | Selected cave's values, partial/search memory, controller, summaries, and best trace. Imports must match the selected campaign/cave/difficulty; an older model cannot replace one with more completed attempts. |
| EXPORT ALL REPLAYS / IMPORT REPLAYS | All caves' AI inputs, outcomes, and provenance. Import verifies every trace against the engine before an atomic import, skips duplicate IDs, and preserves existing models and recordings. |

AI imports are limited to 32 MB; replay imports accept up to 10,000 runs. Exports can grow beyond these limits, so check backup size before relying on a restore. Import/export uploads nothing. Storage belongs to the site's origin: localhost, another port, and GitHub Pages each have separate data. Clearing site data removes local models and replays.

**RECOVER EARLIER REPLAYS** works only for supported older summary-only models when deterministic reconstruction matches every stored route fingerprint and outcome. Rows are marked **Verified reconstruction**. Missing or mismatching history is refused. Planned runs need their saved replay inputs; a model alone cannot reconstruct every earlier attempt.

Keyboard wins are separate: **WATCH PLAYTESTS → IMPORT LIVE RECORDING** imports verified individual exports. The latest ten successful keyboard recordings remain in local storage; an AI archive export does not replace exporting them.

For developer continuation from exported backups, see [development commands](DEVELOPMENT.md#planner-continuation).
