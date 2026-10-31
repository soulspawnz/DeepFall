# Deepfall

[Play online](https://soulspawnz.github.io/DeepFall/)

A browser cave puzzle game inspired by C64 Boulder Dash: dig through dirt, collect enough diamonds, and reach the exit without being crushed. Original sprite geometry appears in green on black, with sound synthesized by a bundled reSID emulator.

Includes **Boulder Dash I's 20 stages at five difficulties**, a separate three-cave Deepfall expedition, and a persistent learning player with live planning previews and replay history.

## Play locally

With Node.js installed, run from this directory:

```sh
node serve.mjs
```

Open [localhost:8767](http://127.0.0.1:8767/). The server binds to localhost and serves an explicit allowlist of game assets. Set `DEEPFALL_PORT` to choose another port. Any static HTTP server also works; opening `index.html` directly as a file does not support the ES modules.

No build, runtime package installation, account, or API key is required. Game assets and synthesis run locally; optional Google Fonts fall back to system fonts.

## Controls

| Input | Action |
| --- | --- |
| Arrow keys / WASD | Move and dig |
| Space + direction | Dig or collect without moving |
| Enter | Start or continue |
| P | Pause / resume |
| R | Restart the selected cave |
| F | Toggle fullscreen with a centered 4:3 stage |
| Z, in Echo mode | Rewind up to 16 simulation ticks, three times per cave |

Horizontal pushes need clear space beyond the rock; original-campaign pushes also use a chance-based rule. Mobile controls support held directions. Losing window focus pauses manual play. Changing cave, difficulty, or mode starts a fresh cave.

**Classic** disables rewinds and fall warnings. **Echo** adds both. Fullscreen keeps black borders where needed and provides a viewport fallback when native fullscreen is unavailable.

After 1.2 seconds of confirmed entrapment, the timer drains at 10× speed. Idling alone does not trigger this; the engine considers legal pushes and possible world changes. Older recordings retain their recorded timer rules.

## Sound

Click **SOUND** to enable audio, then choose MOS 6581 or MOS 8580, volume, music, and effects. **SID SOUND CHECK** auditions the effects.

The original campaign uses extracted C64 gameplay sound routines and an optional original title tune adapted to share the SID with gameplay effects. The Deepfall campaign has a custom score. Pause and death use newly composed SID themes; the death theme ends rather than sustaining indefinitely. Hidden tabs and SOUND OFF stay silent. Live search previews are muted.

One emulated three-voice chip handles all synthesis. This is a browser adaptation, not hardware-exact C64 audio. See [media provenance and audio behavior](docs/ORIGINAL_MEDIA.md).

## Learning player

1. Select a campaign, cave, and difficulty.
2. Choose **1, 5, 10, 25, 50, or 100** attempts and **Auto** exploration, or a fixed percentage.
3. Click **TRAIN PLAYER**. **Render training in game** is enabled by default; uncheck it for background training.
4. Inspect **Graphs** or **Replays**, or use **WATCH BEST RUN** / **WATCH BEST PROGRESS**.

During live training, **SHOW BRANCHES** toggles the planning overlay:

| Color | Meaning |
| --- | --- |
| Lime | Recent animated route |
| Cyan | Sampled, physics-tested continuations at the candidate endpoint |
| Dashed red | Tested alternatives that ended in death |

The outlined endpoint can be ahead of the animated player. Search may rewind or change candidates; these previews are not one continuous playthrough. Up to 12 local alternatives appear, rather than the whole search tree. The final chosen run is labeled separately. The manual cave stays paused and is restored afterward.

Auto starts at 25% and reviews progress every five completed training attempts, within a 10–60% range. It can favor reliable routes or broaden a stalled search. Evaluation runs do not count as training successes. **STOP TRAINING** keeps completed attempts; unfinished attempts are not saved as completed runs.

The player combines a learned decision table with bounded physics search and retained partial routes, including butterfly, amoeba, and magic-wall setup proposals. It is **not a neural network**, and it can plateau. Collecting the quota is not a win: it must reach the exit. See [how learning, planning, and evaluation work](docs/LEARNING.md).

## Replays and backups

The learning card has **Overview**, **Graphs**, **Replays**, and **Data** tabs. It can be collapsed with **HIDE CONTENT**. Graphs use the full selected cave archive; filters and pagination do not delete history.

Every completed AI training attempt, baseline, and evaluation is stored in this browser. Under **Data**, export **both the learning model and all replays** before clearing browser data or moving to another browser. Imported replays are checked against the engine and deduplicated. [Backup and recovery details](docs/LEARNING.md#storage-backups-and-recovery).

**WATCH PLAYTESTS** is a separate library for the bundled 300-attempt automated archive, historical screenshot-only results, and locally recorded keyboard wins. Successful keyboard runs retain the latest ten recordings, separately from the AI archive. [Verification and replay evidence](docs/VERIFICATION.md).

## Fidelity and credits

All 100 original cave/difficulty layouts and parameters match the pinned reference decoder. The engine includes amoebas, magic walls, directional enemies, chain explosions, delayed falling, and original diamond values. Timing, randomness, presentation, lives, and score handling differ from the original C64 executable.

- [Campaign data, mechanics, and fidelity limits](docs/ORIGINAL_CAMPAIGN.md)
- [Graphics, sound sources, and attribution](docs/ORIGINAL_MEDIA.md)
- [jsSID/reSID license](vendor/jssid/LICENSE.md)
- [Development, testing, and deployment](docs/DEVELOPMENT.md)

Original Boulder Dash designs, art, and sound remain attributable to their creators and rights holders. Bundling reference assets does not assert new ownership or a blanket license over them. The full original game executable is not included.
