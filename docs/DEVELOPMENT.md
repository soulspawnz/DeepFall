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
node --test test/route-planner.test.mjs test/learning-player.test.mjs test/adaptive-exploration.test.mjs
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
| Training / preview | `learning-browser.mjs`, `training-preview-browser.mjs` |
| Imports / graphs / Auto | `learning-library-browser.mjs`, `learning-progress-browser.mjs`, `adaptive-exploration-browser.mjs` |
| Replays / fullscreen | `replay-browser.mjs`, `fullscreen-browser.mjs` |

All paths above are under `test/`. Headless browser checks use isolated browser storage. Preserve the user's active cave and existing data during visible in-app testing. For background-training checks, uncheck **Render training in game**; preview checks should verify actual animation and restoration of the manual cave.

The [verification guide](VERIFICATION.md) distinguishes automated archive results, regression tests, visible search previews, and recorded keyboard runs.

## Planner continuation

Back up the selected model and the replay archive through the UI before continuing a user's learning outside the browser:

```sh
node tools/train-planner.mjs MODEL_JSON REPLAY_JSON OUTPUT_PREFIX 5 600
```

Arguments select exported files, an output prefix, maximum attempts, and search-node budget. The tool writes `.model.json` and `.replays.json` after each completed attempt, stops the training loop early on a win, then evaluates and saves that result. Its replay output contains the newly generated records, not a replacement copy of the source archive. Source backups remain untouched. Import the output model and new replays through **Data**.

The CLI currently uses the learning player's default fixed exploration value (25%); it does not run the UI's Auto controller. Use browser training when testing Auto behavior. Keep private exports and input traces outside tracked fixtures, verify added recordings through the engine, and compare previous archive IDs/contents after merging.

## Asset maintenance

- `npm run build:sid` verifies pinned upstream hashes and regenerates the reSID module wrapper.
- `node tools/import-original.mjs` rebuilds cave data and reference hashes from the pinned reference files.
- `node tools/import-original-sfx.mjs` extracts selected audio routine/table bytes from a locally cached disassembly whose hash must match. Its cache path is workstation-specific; it is not a general download command.
- `npm run playtest:original` regenerates the bundled 300-attempt archive. Run only when a rule or test-policy change requires new results; verify the resulting recordings afterward.

Source and fidelity details are in [ORIGINAL_CAMPAIGN.md](ORIGINAL_CAMPAIGN.md), [ORIGINAL_MEDIA.md](ORIGINAL_MEDIA.md), and the vendor provenance files. The [REA project](https://github.com/morluto/rea) was investigated as a possible analysis aid; this repository does not depend on it, and no REA-derived executable analysis is claimed.

## Static hosting

The repository is arranged for GitHub Pages from the root of `main`, with `.nojekyll`. Runtime asset, replay, and worklet URLs are relative so the game can run under `/DeepFall/`. A commit still needs to be pushed and deployed before local changes appear on the hosted site.

The preview server's allowlist intentionally excludes development docs and private files. Read documentation in the repository; no server change is needed for a documentation-only edit.
