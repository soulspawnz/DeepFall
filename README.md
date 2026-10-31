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

## Recorded play tests

All 100 original stage/difficulty variants received three input-driven automated attempts: 300 total, 26 wins and 274 deaths/time-outs, with zero engine exceptions. These are goal-seeking attempts, not proof of completion of every cave. `docs/playtest-original.json` retains every input and outcome; the CSV gives a compact table. Click **WATCH PLAYTESTS** to replay them at normal speed in the game; click again to stop. Manual cave/restart controls stop the replay. Sound remains opt-in. The first replay is a complete Cave A/1 win.

`tools/playtest-original.mjs` regenerates the attempts; `test/playtest-replays.test.mjs` verifies all 300 reproduce their recorded results. `skills/browser-validation/SKILL.md` records the reusable browser-check workflow.

## Fullscreen

Click **FULLSCREEN 4:3** or press **F**. The game uses a centered 4:3 stage with black borders to preserve sprite proportions. HUD and controls remain available; **F**, **Esc**, or **EXIT FULLSCREEN** exits. Browsers without native fullscreen use a viewport-filling fallback. Touch controls remain available.

## GitHub Pages

The static site publishes from the root of `main`; `.nojekyll` enables direct static serving. Asset and replay URLs are relative to the game module, so deployment under `/DeepFall/` works. No server, build step, account or API key is required to play. Sound starts after a click and runs locally in the browser.
