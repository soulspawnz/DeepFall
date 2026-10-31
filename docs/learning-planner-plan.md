# Planning and partial-run learning

> Historical record of the first planner implementation. Later changes add supply-aware butterfly planning and branch visualization. See [LEARNING.md](LEARNING.md) for current behavior; the result below is the initial validation, not a latest-best benchmark.

Deliverable: a stronger physics planner that branches from verified promising partial inputs, retaining existing learned values, attempts, best wins and all archived replays. Test original B/1 with explicit search/training limits and verify any claimed win by replaying its inputs through the unchanged engine.

Constraints: no cave edits, teleporting, hardcoded winning route or reassignment of old replay outcomes. Keep earlier policy revisions available for legacy recovery. Existing browser data is backed up before validation in that browser. Failed attempts remain saved.

Non-goals: solving the full campaign or promising convergence on every cave.

Phases:
1. Back up current model/replays and establish a B reference.
2. Add bounded multi-route physics search, reusable partial checkpoints and preserved legacy learning.
3. Wire worker/archive/UI with provenance and continued training from existing data.
4. Test B, deterministic replay, serialization, cancellation and preserved history; report the actual outcome.

Acceptance: old models load without dropping their action values; existing archived record IDs and inputs stay intact; partial experience influences subsequent searches; a B success counts only after a real exit and an independently verified replay; evaluation remains distinct from the best observed run.

Completed: added a wall-aware multi-route physics planner with snap/push/escape tactics, pre-hazard checkpoints and persistent partial/frontier/visited memory. Continued a locally backed-up model without resetting the value table. B/1 reached an actual exit on the third additional completed attempt (10 diamonds, 314 inputs, 484 search expansions), and its input trace reproduced in a fresh engine and in the visible app. Old archive records were compared before/after merging the new training and evaluation records. Legacy learning/recovery tests, new planner memory tests, and worker/import browser checks passed. Private backups and exact user input traces remain local.
