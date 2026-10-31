# Original graphics and gameplay sounds

The C64 sprite atlas is pinned to Jake Gordon's reference repository commit `61f0bb59785878669a28796c471845bb9a91402e`. The original pixel geometry and animation frames are retained. `sprites.mjs` converts every atlas pixel to green luminance on black and draws it with nearest-neighbor scaling. This intentionally changes the original multicolor palette to the user's requested monochrome look. Atlas provenance and SHA-256 are in `vendor/original-media/SOURCES.json`.

Gameplay sound code comes from the annotated original C64 disassembly at https://www.retrointernals.org/boulder-dash/boulder-dash-disassembly.html. Exact selected address ranges and source hash are in `original-sfx-provenance.json`. `tools/import-original-sfx.mjs` rebuilds `original-sfx-data.mjs` from the cached source. `original-sfx.mjs` executes those bytes using a bounded, purpose-specific 6502 instruction interpreter and sends SID register writes directly to the bundled reSID chip emulator.

The original tables cover boulder impacts/pushes, randomized diamond impacts, diamond collection, movement through dirt/space, explosions, birth crackle, amoeba, magic wall, and the last-seconds warning. The cave-completion countdown is a direct register-level adaptation of the published voice-three loop, scheduled in approximately 1 ms steps. It is not a newly composed fanfare. The optional Echo rewind reuses the crackle; Echo itself is an extension.

The bundled ranges also include the original title tune's routine and tables. MUSIC ON can play that tune during the original campaign; this is an adaptation, since original cave gameplay did not have continuous backing music. The melody uses two voices, with gameplay effects temporarily borrowing their original voices. The separate Deepfall campaign uses a custom eight-bar E-minor score and custom effects.

Pause uses a newly composed quiet SID loop. Death lets its original one-shot effect drain, then plays a short descending lament and falls silent. MUSIC OFF silences these state themes independently of EFFECTS. Hidden tabs, SOUND OFF, and live search previews are silent. These additions use the same emulated chip, not audio samples or extra oscillators.

The emulator is Joe Hohertz's JavaScript port of Dag Lem's reSID, pinned to commit `15c861537a6aefdfd242a2692380a537f4c8e66a`. It uses the stable interpolating engine with MOS 6581/8580 selection, one three-voice SID, PAL clock 985248 Hz, and a 50 Hz sequencing cadence. AudioWorklet synthesis runs on the audio thread. Output is mono; master volume uses output gain. Upstream provenance and source hashes are under `vendor/jssid/`.

Fidelity limits: this is not the full C64 executable. Register-write CPU-cycle positions and the approximately 1 ms completion sweep are not cycle exact. CIA timer entropy is replaced with deterministic randomness. Event scheduling follows this browser engine; unlock uses the crackle. Analog chip variation and original display/raster timing are outside this implementation. Matching source tables and sprite shapes does not establish hardware-identical audiovisual output.

Attribution: original Boulder Dash art, game designs and sound routines remain attributable to their original creators and rights holders, including Peter Liepa, Chris Gray and First Star Software. The atlas was obtained via Jake Gordon's reference implementation. No new ownership or blanket license over the original game assets is asserted. The jsSID/reSID license remains in `vendor/jssid/LICENSE.md`.

## Play-test evidence

`playtest-original.json` records 300 accelerated, input-driven engine attempts: all 20 stages at all five difficulties, three route-order policies each. Results: 26 wins, 274 deaths/time-outs, zero engine exceptions. Every input is retained; a replay test checks all 300 final states. The agent seeks diamonds and exits, explores dirt and tries horizontal pushes; it does not solve advanced enemy/amoeba puzzles. Failed attempts do not establish that those caves are impossible or broken. Not every cave has a verified winning route.

The game offers WATCH PLAYTESTS to render those same inputs at normal speed, including failed attempts. It uses the regular game engine, renderer and audio path. This replay is distinct from accelerated engine runs, separate Chromium browser checks, live learning search previews, and recorded keyboard play. See [verification and evidence](VERIFICATION.md) for those distinctions and [development](DEVELOPMENT.md) for test commands.
