# Verification and recorded evidence

## What is verified

| Evidence | Scope |
| --- | --- |
| Cave goldens | All 20 original stages at five difficulties match the pinned independent decoder's 88,000 cells, quotas, and time limits. |
| Mechanics tests | Targeted cases for gravity, pushes, enemies, explosions, amoeba, magic walls, timers, and progression. |
| Exact replay tests | Recorded consumed inputs reproduce their expected outcomes in the engine. |
| Browser checks | Rendering, AudioWorklet output, controls, imports, persistence, preview behavior, and responsive layout. |
| Learning tests | Controlled comparisons, preserved model memory, replay verification, Auto cadence, and history aggregation. |

These establish specific behavior, not cycle-accurate C64 execution or successful completion of every original cave. [Campaign provenance and limits](ORIGINAL_CAMPAIGN.md).

## Bundled automated archive

[playtest-original.json](playtest-original.json) contains 300 accelerated, input-driven engine attempts: every original stage/difficulty variant received three route-order policies. The archive has **26 wins and 274 deaths/time-outs**, with zero recorded engine exceptions. [CSV summary](playtest-original.csv).

These were fixed goal-seeking policies, separate from the persistent learning player. Failures do not prove that a stage is impossible or that the current planner will fail there. The archive is historical evidence, not a fresh benchmark of each later planner revision.

**WATCH PLAYTESTS → WATCH AUTOMATED ARCHIVE** renders the stored inputs through the regular engine, renderer, and audio path. The first recording is an original A/1 escape. `test/playtest-replays.test.mjs` verifies all 300 recorded outcomes; the focused browser test checks playback and advancement.

## Keyboard recordings and historical screenshots

The library retains [earlier A](live-A-won.png) and [earlier B](live-B-won.png) result screenshots from before input recording existed. They are explicitly screenshot-only evidence, not playable input recordings. Missing keyboard inputs are never invented or reconstructed from a screenshot.

New successful keyboard attempts save their actual engine-consumed inputs, including idle ticks, snap-digging, and Echo rewinds. Pauses are omitted. The latest ten recordings remain in local storage and can be replayed or individually exported. These are distinct from AI records in IndexedDB.

## Learning results and interpretation

[learning-evaluation.json](learning-evaluation.json) and the completed implementation plans retain historical measurements from earlier policies. They do not describe the current planner's expected performance on every model. Tests can demonstrate a reproducible improvement without guaranteeing convergence on a harder cave.

When reporting new training results, distinguish:

- New exploratory attempts from baseline and evaluation records.
- The current evaluated policy from the best retained trace.
- Diamond progress from an actual exit.
- A search budget ending from in-game death or timeout.
- Live search animation, which can change branches, from a single continuous keyboard run or exact saved playback.

The arrow overlay visualizes a bounded sample of tested continuations at one expanded candidate; it is not the entire frontier or proof that those continuations lead to an exit. Repeated partial results can be a real plateau even when many different states were searched.

Private user models, archives, and input traces stay local. Check preservation by comparing earlier archived records and retained decision keys before and after an upgrade. Do not publish those exports as fixtures or substitute an unverified result for an old recording.

See [development commands](DEVELOPMENT.md#tests) for the test entry points and [learning behavior](LEARNING.md) for current memory, evaluation, and backup rules.
