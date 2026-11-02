# Published training snapshot

[Open the mobile demo](https://soulspawnz.github.io/DeepFall/?demo=1#learning-player). Choose a cave at difficulty 1; use Graphs, Replays or Overview to explore its history. The History source selector switches back to Saved in this browser for normal training.

`snapshot.json` contains actual learning-model and replay exports from the local game's Data tab on 2 November 2026, published at the owner's explicit request. It includes all 447 archived AI runs (367 training records plus baselines and evaluations), nine models, failed attempts, exact input traces and original provenance labels. All replay outcomes and all models were validated against this game implementation before publication. The uncompressed snapshot is about 3.3 MB and is fetched only when the published source is selected.

| Cave, difficulty 1 | Recorded training runs | Training escapes | First recorded escape |
| --- | ---: | ---: | ---: |
| A | 75 | 74 | 1 |
| B | 232 | 28 | 196 |
| C | 5 | 5 | 1 |
| D | 30 | 2 | 27 |
| Intermission 1 | 2 | 0 | — |
| E | 1 | 1 | 1 |
| F | 1 | 1 | 1 |
| G | 20 | 13 | 8 |
| H | 1 | 0 | — |

The demo reads this snapshot separately from IndexedDB. It never imports into, overwrites, or merges with the visitor's local models/replays. Training, recovery and imports are disabled while viewing it; normal manual gameplay and recorded playback remain available. Export Learning downloads the selected published model. Export All Replays downloads the published replay archive, compatible with the existing explicit import controls in local mode. Public model imports still apply their normal compatibility and older-model safeguards.

The browser verifies each selected cave's replay outcomes before displaying its history and validates the corresponding model. This work yields between groups of ten replays. Completed contexts are cached for the page session. Empty caves/difficulties are shown explicitly; no attempts are invented.

These are historical results, not evidence that a phone just trained the player. Planner implementations changed during the history, so this is not a controlled experiment isolating learned priorities. Some successful attempts reuse remembered routes; evaluations establish retention, not independent discovery. Verified reconstructions retain their labels. Quotas alone are not wins. Graph win rates use training records only; the learner is not a neural network or a universal solver. Validation uses DeepFall's JavaScript engine, not the original C64 program.

Verification: `node --test test/published-training.test.mjs test/learning-library.test.mjs test/learning-progress.test.mjs`; browser checks use `test/published-training-browser.mjs`, `test/learning-library-browser.mjs` and `test/learning-progress-browser.mjs`. Browser scripts accept the installed Playwright module, Chromium executable, private screenshot directory and optional base URL as positional arguments. The demo check uses a fresh 390×844 Chromium touch context, verifies a saved G escape through playback, local-data preservation and an unavailable-snapshot fallback. This is browser emulation, not a physical phone or Safari test.

To refresh this public snapshot, export all replays and each trained model through Data, validate every trace with `verifyLearningReplay` and each model with `validateLearningModel`, then replace the snapshot and update the date/counts together. Publish only explicitly authorized game exports; do not include browser profiles, diagnostics, screenshots, tokens or unrelated downloads. Existing browser learning never synchronizes to GitHub automatically.
