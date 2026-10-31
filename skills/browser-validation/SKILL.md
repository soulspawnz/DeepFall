# Deepfall browser validation

Use for repeated verification of the local Deepfall game after UI, sprite, campaign or SID changes.

## Contract

Deliverable: reproducible browser checks and screenshots, with actual failures reported. Preserve the user's live browser session and unrelated processes. Engine simulation, headless browser checks and live in-app interaction must be reported separately. Do not claim automated attempts are human completions.

## Workflow

1. Read the changed modules and run appropriate Node tests through `I:\Nexus\Cortex\run.cmd -x node`.
2. Confirm the task-owned preview serves HTTP 200 on port 8767. Restart only its exact owned Node PID if the allowlist changed; use hidden startup. Never terminate unrelated processes.
3. Run `test/original-media-browser.mjs` with the installed Playwright module path, installed Chromium executable path and screenshot output directory. This verifies atlas palette, real AudioWorklet output, both SID models and errors.
4. Run `test/original-browser.mjs` for campaign, layout or control changes. Use `test/sid-browser.mjs` for Deepfall soundtrack changes. Browser scripts take the same three arguments. These checks use a separate headless browser.
5. Run `test/replay-browser.mjs` when replay UI changes, and `test/playtest-replays.test.mjs` when engine rules change. Regenerate the 300 attempts only when rule/solver changes invalidate them.
6. Review a screenshot of the active game, and report tested outcomes and limits. The in-app browser must be controlled through its provided runtime; if unavailable, say so and offer the visible replay control.

## Configuration

Project: `I:\Nexus\Games\Deepfall`. URL: `http://127.0.0.1:8767/`. Existing scripts accept caller-supplied browser dependencies and output paths; do not install duplicates. Sandbox escalation may be needed for localhost Chromium.

## Acceptance

No browser page errors, audible nonzero SID output after a user gesture, correct atlas palette, usable mobile width and replay results matching the recorded engine inputs.
