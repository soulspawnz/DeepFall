# C64 and Lumen presentations

The LOOK & SOUND selector above the cabinet changes graphics and audio together. C64 is the default. Lumen is an optional, original interpretation: emerald crystals, shaded rock and masonry, living green amoeba, gold fireflies, violet butterflies, a lit exit and a helmeted explorer. It works for both campaigns, normal play, AI previews and recorded playback. This is a presentation choice independent of Classic/Echo gameplay.

Switching preserves the current game object, grid, player, score, timer, selected cave and replay inputs. The preference is stored under `deepfall.presentation`; no models, attempt archives or replay formats change. Reloading remembers the look but still requires a click to enable sound.

`lumen-sprites.mjs` draws new vector geometry into small cached canvases. The game canvas uses a fixed 3x backing resolution, avoiding device-pixel-ratio allocations, and retains the same 16-unit coordinates and tile boundaries as the original renderer. Animated sprites have bounded frame counts. Diamonds show changing facets and sparkles; creatures and the explorer animate. Reduced-motion mode freezes decorative animation. No image-generation service, downloaded art or PhotoCraft/VectorCraft project is required; edit the drawing functions to change the assets.

`lumen-audio.mjs` is a separate Web Audio engine, not SID emulation. It composes an original four-chord crystal sequence with bass, bell harmonics and stereo placement; gameplay has new pickup, impact, dig, portal, rewind, blast and escape cues. Pause plays a sparse chord variation when music is enabled. Death plays a short falling phrase that ends. A deterministic stereo impulse gives a short cave reverb; a compressor limits mixed peaks.

Every oscillator has a scheduled stop. At most 48 voices can exist, the lookahead is 180 ms with bounded catch-up, and the reverb is 850 ms. Restart cancels pending voices. Hidden-tab/training mute silences the output; sound-off cancels voices, clears the scheduler and suspends its context. Switching presentations disables the previous engine before enabling the selected one. Master volume, music/effects toggles and SID model preference are retained. The C64 atlas, sound routines and reSID implementation remain in their existing modules.

Verification on 2 November 2026:

- `test/presentation-browser.mjs`: exact paused-game preservation across style switches, both resolutions, measured output and left/right signal difference, pause music-off, finite death theme, 48-voice cap, silent output, context handoff, persisted preference, phone layout and bonus-cave sizing.
- `test/mobile-browser.mjs ... BASE_URL --lumen`: eight phone/tablet viewports and rotation, actual touch movement/release/cancel, snap, Echo, native/fallback fullscreen and an audio-output/mute sample.
- `test/fullscreen-browser.mjs ... BASE_URL --lumen`: native desktop and mobile fallback 4:3 stage checks.
- `test/original-media-browser.mjs ... BASE_URL`: unchanged green atlas palette and audible original routines on both SID models.
- `test/audio-lifecycle.test.mjs` and `test/published-training.test.mjs`: original SID lifecycle and exact outcomes for all 447 published replay traces and nine models.

Browser scripts take the installed Playwright module, Chromium executable, private screenshot directory and optional base URL. Screenshots remain private. Suspended AudioContexts can retain stale analyser/parameter readings; mute verification checks suspension, then resumes only the isolated diagnostic context to verify zero output. These are desktop Chromium and touch-emulation checks, not physical Android/iOS, Safari, performance guarantees or hardware C64 fidelity. The optional artwork/audio is produced in code; no changes were made to any open craft-app project.
