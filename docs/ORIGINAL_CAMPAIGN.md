# Original Boulder Dash I campaign

Implemented on 2026-10-31. Scope: reproduce the original cave data exactly, make all stages selectable/playable, and supply the mechanics those stages require. The three existing Deepfall caves remain a separate campaign.

## Campaign and difficulty

The order is `A B C D I1 E F G H I2 I J K L I3 M N O P I4`.

All five original difficulty seeds, diamond quotas, time limits, base/extra diamond values, amoeba slow-growth/magic-wall timing, encoded object headings, and terrain drawing instructions are preserved. The decoder consumes random values across all 40 columns of 20 interior rows, overlays the steel border, then executes the original single-object, line, filled-rectangle, and outline-rectangle commands. The original two-byte arithmetic randomizer is used for map generation. Nothing is carved to make the originals easier. Boundary outboxes remain exactly where encoded, including Cave C's outbox on the outer boundary.

Intermissions are inserted after each group of four caves. A failed bonus attempt continues to the next cave; R can retry it as a practice convenience. Completing Intermission 4 returns to A at the next difficulty, capped at difficulty 5, matching the original circuit order. All caves are directly selectable for practice, including the four intermissions.

## Provenance and verification

- Primary cave-byte specification and data by Jeff Bevis / Peter Broadribb: https://www.elmerproductions.com/sp/peterb/rawCaveData.html
- Original PRNG, demo input stream and progression notes: https://www.elmerproductions.com/sp/peterb/insideBoulderdash.html
- Pinned independent JavaScript decoder reference by Jake Gordon: https://github.com/jakesgordon/javascript-boulderdash/tree/61f0bb59785878669a28796c471845bb9a91402e
- Published decoded cave diagrams: https://jakesgordon.com/writing/javascript-boulderdash/decoded_cave_data.pdf

The 20 imported byte streams were checked against the primary HTML. Nineteen match directly. That HTML omits Intermission 3's initial cave-number byte `0x13`; the Cave 19 heading, pinned mirror, and decoded reference retain its identity. Prepending that one metadata byte yields an otherwise exact match. No layout or gameplay parameter byte was changed. The primary document hash and normalization note are retained in `original-primary-verification.json`.

The reference decoder independently generated 100 raw 40x22 map SHA-256 hashes (20 caves x 5 difficulties) using its documented difficulty selector fields. The game's separately implemented decoder matches all 88,000 object-code cells, plus every quota and time limit. Goldens are in `test/original-goldens.json`. This verifies correspondence to the pinned decoder and primary encoded payloads; it is not an emulator or ROM-playback comparison.

`test/original-mechanics.test.mjs` checks the additional mechanics and initializes/simulates all 100 variants. A fixed 177-tick input trace completes original Cave A/1 with 14 diamonds and the original outbox coordinate `(38,16)`. This verifies that specific engine playthrough, not completion of every original difficulty.

The reference source and its MIT declaration are retained under `vendor/original-caves/`; attribution of the original cave designs remains with Peter Liepa, Chris Gray and First Star Software. `tools/import-original.mjs` rebuilds the data module and reference hashes offline from these pinned files.

## Fidelity boundary

The maps and original parameter sets are exact. The browser engine supplies the original mechanics needed by these caves: amoebas, timed magic walls, directional wall-following enemies, crush/contact/chain explosions, five explosion stages, original point values, birth delay, scan-order movement, delayed falling, and chance-based pushing.

This is not a cycle-accurate C64 executable port. The 120 ms simulation clock, real-time countdown, deterministic runtime random stream, birth timing, whole-cave view, reSID analog model, practice access, unlimited retries and per-cave score display differ from the original machine/game shell. The C64's difficulty-dependent workload timing, CIA-timer randomness, lives and hardware quirks are not emulated. Echo adds optional rewinds and warnings; confirmed entrapment accelerates the countdown. Original sprite geometry, gameplay sound routines, and the optional title tune are bundled; the full game executable is not. See [media provenance](ORIGINAL_MEDIA.md). These distinctions prevent an exact-data claim from being mistaken for full hardware equivalence.
