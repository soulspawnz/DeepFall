# Persistent learning player

Deliverable: a browser player that explores alternative routes, retains outcome-based action values across attempts/reloads, and exposes honest progress and replayable wins.

Constraints: use the actual game physics, keep simulated training separate from live keyboard recordings, isolate CPU-heavy training in a worker, preserve unrelated pending music changes, and never label diamond quota alone as a win.

Non-goals: neural-network training, guaranteed completion of every cave, changing cave layouts/physics, or silently replacing human play.

Acceptance: persistent experience changes action selection; different seeds explore different routes; a controlled reproducible evaluation measures improvement; saved winning inputs reproduce a real exit; stopping training leaves the UI responsive; malformed/old saved data is handled safely.

Phases: (1) simulation and Monte Carlo route learning, (2) worker and training controls, (3) learning/replay tests and measured cave results, (4) visible app verification.

Completed: the A/1 evaluated policy improves from 285 to 164 steps after ten attempts, explores eight routes, and reproduces its win after save/reload. Browser checks cover training, persistence, stop, cave isolation, mobile layout and separation from live recordings. A's best learned trace was also shown at normal speed in the in-app browser. Other caves are trainable but have no completion guarantee.

Post-mortem: adding immediate diamond reward to a learned whole-attempt return double-counted the greedy preference and prevented learned detours from winning selection. Known choices now use their learned return directly; unseen choices use the planning prior. Candidate corridors must also be truncated at a viable escape point when simulated gravity makes their far end unsafe. Benchmarks must compare the evaluated policy itself, not only the shortest trace discovered during exploration.

Replay-history extension: every completed training attempt, cold baseline and later evaluation is committed to IndexedDB alongside its learning model before the worker is allowed to continue. History is paginated without trimming, includes failures and training-limit outcomes, and supports individual/chronological replay and a full export. Interrupted unfinished attempts are not counted as completed. Legacy A history was reconstructed only after matching all recorded input fingerprints and outcomes; those twelve records are marked as verified reconstructions. Core tests reproduce every recovered result, and browser checks cover persistence, failed-attempt playback, playlist start/stop and storage-unavailable behavior.
