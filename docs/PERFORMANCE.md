# Search profiling and repeatable benchmarks

Profile a fixed workload before changing the planner. Use exported copies of a selected cave's model and replay archive, never the browser's live database as the benchmark output. Keep private models, profiles, and input traces outside version control.

## CPU profile and timing

Run from the repository root with Node.js:

```sh
node --expose-gc tools/profile-search.mjs MODEL_JSON ARCHIVE_JSON OUTPUT_PREFIX 600 3
```

The final optional argument selects another source root, such as a detached baseline worktree:

```sh
node --expose-gc tools/profile-search.mjs MODEL_JSON ARCHIVE_JSON BEFORE_PREFIX 600 3 BASELINE_DIRECTORY
node --expose-gc tools/profile-search.mjs MODEL_JSON ARCHIVE_JSON AFTER_PREFIX 600 3 CURRENT_DIRECTORY
```

Use the same model, archive, node budget, repeat count, Node version, and machine conditions. Run before/after jobs sequentially; avoid other CPU-heavy tests or training during timing. A separate worktree or source snapshot freezes the baseline while the working implementation changes.

The harness:

1. Validates the exported files and prepares the same archive-seeded partial memory used by the UI.
2. Runs one additional attempt with Node's CPU profiler, writing `OUTPUT_PREFIX.cpuprofile` and printing the largest sampled self-time frames.
3. Runs the requested number of unprofiled samples. Each starts from a fresh copy of the same saved model, seed `attempts + 1`, fixed 50% exploration, and the requested node budget.
4. Reports elapsed time, process CPU time, heap delta, expanded nodes, and outcome. The median excludes the profiled run. Model construction, explicit pre-run GC, and post-run replay verification are outside the timed search/learning interval.
5. Verifies the resulting replay and checks that all repetitions produce identical hashes of the recording, resulting model, and yielded search progress.

The summary is written to `OUTPUT_PREFIX.json`; output files use exclusive creation to protect earlier measurements. The input backups are read-only. The harness never imports its trials into the browser or saves a new user model.

Open `.cpuprofile` files in a compatible JavaScript profiler. Sampled percentages are estimates, and elapsed time can vary with scheduling and other machine activity. Compare CPU time as well as elapsed time. Heap delta is not peak RAM or total allocation volume.

For behavior-preserving changes, compare the before/after recording, model, and progress hashes as well as speed. A faster result caused by a different route, smaller budget, altered priorities, or omitted physics is a different experiment.

## Current implementation

The search remains single-worker JavaScript. Optimizations target repeated work rather than changing the strategy:

- Physics handles the player before skipping terrain that has no per-cell updates. Loose objects, enemies, amoeba, scan order, and moved-object checks retain their rules.
- Simulation clones copy mutable physics containers directly rather than constructing an intermediate snapshot and wrapping its collections again.
- Search keys serialize the same ordered fields without deep-copying the grid first; persisted key bytes remain compatible.
- Each search locally caches keys and analysis for immutable successor states. Live mutable games are not placed in those caches. Distance vectors remain bounded by the existing global cache rather than retained for every search node.
- Distance propagation uses numeric cell indices instead of allocating coordinate pairs. Generation/setup analysis is reused; stages without amoeba or magic walls skip that analysis internally.

Learned multipliers, search budgets, action ordering, and replay formats remain the same. More states per second does not establish better planning or a solved cave.

## Verification

Run `test/search-performance.test.mjs` for exact key compatibility across all original variants and isolation of cloned mutable state. Run mechanics, replay, planning, and learning tests for changes to these shared modules. The same bundled replay inputs must still reproduce their recorded outcomes.

Finally, run a bounded visible trial in the app with the user's preferred preview settings. The live status reports elapsed worker search time, including scheduling and yield delays, rather than CPU time. This transient measurement is excluded from saved models and replays. Smooth playback intentionally waits to display a completed attempt before the next one starts; its animation and storage acknowledgements are outside the worker search timer. Compare earlier archive records after the trial and retain the existing learning model.
