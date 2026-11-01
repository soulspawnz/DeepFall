# Development

The game uses browser ES modules and a DOM-free simulation engine. There is no runtime dependency installation or build step. `package.json` provides test and maintenance commands.

## Local preview

From the repository root:

```sh
node serve.mjs
```

Open [localhost:8767](http://127.0.0.1:8767/). `DEEPFALL_PORT` overrides the port. The preview server binds to `127.0.0.1`, serves an explicit allowlist, and disables caching. Add new browser modules/assets to that allowlist when necessary. A general static HTTP server can serve the same game files.

On the Cortex workstation, execute commands through its runner. For example:

```powershell
& 'I:\Nexus\Cortex\run.cmd' -x node 'I:\Nexus\Games\Deepfall\serve.mjs'
```

Follow the workspace's agent instructions for automated development. The local [browser-validation skill](../skills/browser-validation/SKILL.md) records the repeated validation workflow.

## Tests

Run the checked-in Node test suite from the repository root:

```sh
npm test
```

For a focused planner change:

```sh
node --test test/route-planner.test.mjs test/priority-learning.test.mjs test/learning-player.test.mjs test/adaptive-exploration.test.mjs
```

Browser scripts are separate from `npm test`. They expect the local server to be running and caller-supplied, existing Playwright and Chromium installations:

```sh
node test/training-preview-browser.mjs "<path-to-playwright/index.mjs>" "<path-to-chromium-executable>" "<existing-output-directory>"
```

Use the corresponding scripts for the changed feature:

| Area | Browser checks |
| --- | --- |
| Original campaign / media | `original-browser.mjs`, `original-media-browser.mjs` |
| Audio / state themes | `sid-browser.mjs`, `audio-lifecycle-browser.mjs` |
| Training / preview / priorities | `learning-browser.mjs`, `training-preview-browser.mjs`, `priority-learning-browser.mjs` |
| Imports / graphs / Auto | `learning-library-browser.mjs`, `learning-progress-browser.mjs`, `adaptive-exploration-browser.mjs` |
| Replays / fullscreen | `replay-browser.mjs`, `fullscreen-browser.mjs` |

All paths above are under `test/`. Headless browser checks use isolated browser storage. Preserve the user's active cave and existing data during visible in-app testing. For background-training checks, uncheck **Render training in game**; preview checks should verify actual animation and restoration of the manual cave.

The [verification guide](VERIFICATION.md) distinguishes automated archive results, regression tests, visible search previews, and recorded keyboard runs.

For CPU profiling and before/after measurements from exported model copies, see [search performance](PERFORMANCE.md). Keep benchmark jobs sequential and compare behavior hashes, not only runtime.

## Planner continuation

Back up the selected model and the replay archive through the UI before continuing a user's learning outside the browser:

```sh
node tools/train-planner.mjs MODEL_JSON REPLAY_JSON OUTPUT_PREFIX 5 600
```

Arguments select exported files, an output prefix, maximum attempts, and search-node budget. The tool writes `.model.json` and `.replays.json` after each completed attempt, stops the training loop early on a win, then evaluates and saves that result. Its replay output contains the newly generated records, not a replacement copy of the source archive. Source backups remain untouched. Import the output model and new replays through **Data**.

The CLI currently uses the learning player's default fixed exploration value (25%); it does not run the UI's Auto controller. Use browser training when testing Auto behavior. Keep private exports and input traces outside tracked fixtures, verify added recordings through the engine, and compare previous archive IDs/contents after merging.

## Offline solver experiments

Two standalone comparison solvers are retained alongside the persistent planner. Importing either module does not start a job or write files. Their CLI requires an explicit output directory, validates cave/difficulty/search limits, and saves only independently replay-verified wins with exclusive creation (existing files are not overwritten). Cave indices are zero-based and follow campaign order, including intermissions.

```sh
node tools/solve-campaign.mjs 6 "<output-directory>" 1 300 1
node tools/solve-macros.mjs 6 "<output-directory>" 500 30000 1
```

`solve-campaign.mjs` takes indices, output directory, seed count, tick limit, and difficulty. It uses a short-horizon beam policy. `solve-macros.mjs` takes indices, output directory, node limit, wall-clock limit in milliseconds, and difficulty. It searches longer goal routes. The exported `solve` and `solveMacro` functions do no file I/O; macro progress can be observed through an optional callback. Both share the regular simulation cloning and complete planner state keys.

Offline output uses `deepfall-offline-solver-1`, with Boolean snap flags, search provenance, and final state metadata. It is not an AI replay archive or evidence of learned experience and is not automatically imported into browser memory. `test/winning-F.json` retains a verified legacy F/1 input trace; the original generator/seed were not recorded, which its provenance explicitly states. `test/offline-solvers.test.mjs` verifies that fixture, import safety, bounds, and output preservation.

The learning player uses related amoeba-access, conversion-waiting, and magic-wall outlet/feed proposals, checked by normal physics. Focused tests are in `test/generation-planning.test.mjs`.

Butterfly planning adds lower-shaft targets and rock-alignment estimates under the learned preparation multiplier. Before the macro search, a bounded event beam explores up to 64 steps with at most 64 retained states per step (at most 36,864 simulated actions); its visited-key cache is capped at 12,000 entries. It only seeds a continuation after actual simulation produces extra supply or collection without death or an insufficient-diamond result. The remaining input budget also bounds this event search. New recordings use planner revision 5 and record `searchTacticalSteps` separately from macro `searchExpanded` / `searchBudget`; an early win from a saved prefix needs no tactical work.

Revision 6 adds amoeba planning in `route-planner.mjs`, using the same shared physics. `searchAmoebaSteps` counts containment, retreat, and settling simulations separately from macro expansions and butterfly work. The event beam is bounded to 96 layers of 48 states with an 8,000-key cache; it tries at most four enclosure retreat/conversion checks. Ordinary macro expansion tests at most two amoeba-work retreats, each with depth 8 / width 8 and four settling inputs. Escape forecasts reject a known falling object still chasing the chosen shaft. All returned sequences remain within the overall input budget when accepted by the route planner.

The `s6` expansion namespace includes the priority profile and proposed fence bounds. Candidate forecasts are sampled for both ordinary and amoeba-objective expansions, so the one-in-four objective lane is actually visible rather than always falling between the usual eight-node samples. Frontier inputs reserve up to twelve distinct amoeba configurations within the existing 64 slots. The original value table, priority observations, and archive records are retained. Run `test/amoeba-planning.test.mjs`, planning/learning regressions, the recorded replay checks, and both training-preview browser modes before live validation. Keep the user's model/archive exports private and compare earlier records after the trial.

Revision 7 adds `amoebaCutFence`, `amoebaContainSearch`, and `amoebaHarvestSearch` in the same module. Vertex cuts propose natural boundaries; real macro-sequence simulation resolves competing rock feeds and changes to old supports. Cap and harvest beams each retain 96 states for at most 24 layers, with action expansion allowances of 260,000 and 400,000 at the normal 600-node budget. Cap forecasts additionally allow at most eight depth-24 / width-32 retreats, four settling steps, and input-budgeted growth waiting. Accepted inputs remain within `maxTicks`. The existing small event beam remains a fallback. `s7` fingerprints include the full proposed boundary rather than only its bounds. Sequence-stage forecasts yield per layer and during conversion waiting; these are branch previews, not separate archive attempts. Coarse duplicate keys prune some RNG/timing alternatives, so long push variants are tested explicitly and every accepted run requires exact engine replay. See [complete amoeba sequences](AMOEBA_PLANNING.md#complete-containment-sequences-revision-7) for ranking and limits.

In caves that initially lack enough loose diamonds, a branch with enough real collected/pending supply enters a harvest phase. Within that phase, outcome fitness guides collection and escape; it is expanded ahead of further generation setups. Learned weights continue to guide setup branches. This prevents supply/preparation multipliers from making the player abandon a successful blast or avoid collecting its diamonds. Search namespace `s5` separates expansions from earlier strategies while retaining old decisions, priorities, partial recordings, and archive records. `test/butterfly-planning.test.mjs` checks an invented shaft fixture, required rock relocation, actual blast supply, bounded work, and an exact escape even with collection-averse scoring weights.

## Asset maintenance

- `npm run build:sid` verifies pinned upstream hashes and regenerates the reSID module wrapper.
- `node tools/import-original.mjs` rebuilds cave data and reference hashes from the pinned reference files.
- `node tools/import-original-sfx.mjs` extracts selected audio routine/table bytes from a locally cached disassembly whose hash must match. Its cache path is workstation-specific; it is not a general download command.
- `npm run playtest:original` regenerates the bundled 300-attempt archive. Run only when a rule or test-policy change requires new results; verify the resulting recordings afterward.

Source and fidelity details are in [ORIGINAL_CAMPAIGN.md](ORIGINAL_CAMPAIGN.md), [ORIGINAL_MEDIA.md](ORIGINAL_MEDIA.md), and the vendor provenance files. The [REA project](https://github.com/morluto/rea) was investigated as a possible analysis aid; this repository does not depend on it, and no REA-derived executable analysis is claimed.

## Static hosting

The repository is arranged for GitHub Pages from the root of `main`, with `.nojekyll`. Runtime asset, replay, and worklet URLs are relative so the game can run under `/DeepFall/`. A commit still needs to be pushed and deployed before local changes appear on the hosted site.

The preview server's allowlist intentionally excludes development docs and private files. Read documentation in the repository; no server change is needed for a documentation-only edit.
