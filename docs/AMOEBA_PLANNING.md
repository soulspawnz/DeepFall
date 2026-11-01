# Amoeba planning priorities

These are engine-grounded planning recommendations, not a claim that a keyboard attempt cleared an amoeba cave or that the learning player has already learned these strategies. Direct play observations and inferred planning improvements must be reported separately. Private playtest screenshots and notes remain outside the repository.

## Implemented planning support

Planner revision 6 implements a conservative growth-region analysis, proposed rock fences, a bounded cap/retreat/conversion search, and escape forecasts. It counts dirt, vacated player cells, moving enemies, and falling objects as potential future growth space. Growth capacity is counted only up to the amoeba limit plus one: a value above the limit is a lower bound, not an exact region size. A bounded region must have enough potential yield; a merely bounded small colony is not confirmed diamonds.

The planner first proposes a nearby work position through the real simulation. It considers rectangular fences around every current amoeba component, missing fence cells, rock feeds, lower shaft clearing, horizontal pushes, and settling. These rectangles are goals for search, never inserted walls. The event search keeps at most 48 states per layer for up to 96 layers, with additional bounded retreat and waiting work counted separately. A completed setup must survive a physics-tested retreat outside the growth pocket before waiting for conversion; surviving near an unbounded colony is not the same achievement.

In the ordinary search, one in four expansions can pursue the fence objective while no verified containment or sufficient-supply branch has priority. A reference fence comes from the simulated approach, and work-site selection favors physical progress against that same objective. Up to twelve strategically distinct amoeba branches share the existing 64-trace frontier budget with the usual candidates. On later amoeba attempts, the first eight frontier traces are considered before rotation; duplicate prefixes are removed so they cannot consume the twelve-seed limit. Their actual inputs are replayed on the next attempt; they are not fabricated completed attempts or archive wins.

Escape checks include growth and delayed gravity, reject an endpoint still threatened by a known pursuing fall, and require current exit connectivity. Their finite horizon is explicit; they do not prove permanent safety. Candidate phase, cell count, and growth openings appear in live progress. Saved runs include their final `amoebaPlanning` summary and `searchAmoebaSteps`; imports verify the summary against the replayed world. Learned action values, prior profiles, and old replay inputs remain compatible. The new expansion namespace also includes the fence objective, preventing an old expansion under a different objective from suppressing new work.

`test/amoeba-planning.test.mjs` uses invented layouts to check unstable boundaries, insufficient yield, a real rock cap and diamond conversion, safe retreat, pursuing falls, full harvest/exit, and metadata integrity. Success on those fixtures does not establish that original G has been solved. The measured outcome of a live cave trial remains separate from these implementation checks.

## Survive the approach

Evaluate entrance protection, birth, enemy movement, and the first escape together. The world advances during entrance warm-up; the nearest enemy in the initial layout may not be the nearest enemy when the player becomes vulnerable. Check every intermediate step of an approach, including idle steps and the retreat, rather than only the destination or diamond reward. An opening blast failure is evidence about the opening, not evidence about amoeba containment.

The existing planner already re-simulates birth and route physics and rejects dead successors. A manual opening failure alone does not establish a defect in those checks. Any proposed change needs a focused fixture showing the missing threat or inadequate continuation horizon.

A longer descent also needs an escape from objects released behind the player. Clearing a vertical shaft beneath supported rocks can create a pursuing fall; surviving its upper section does not prove that stopping at the bottom is safe. Consider side exits and simulate until released objects settle, including the effect of a blocked final move. A bend is only a proposed escape, not a guarantee: verify its cells and timing with physics.

## Grow enough usable supply

Compare the quota with collected gems, reachable loose gems, and the number of amoeba cells that could become recoverable diamonds. Mere amoeba presence is not enough. Prematurely enclosing a tiny colony can leave the cave short of its quota; letting it grow without a containment plan can instead produce rocks.

For example, in a **synthetic** cave with quota 12 and four recoverable loose gems, the plan needs at least eight additional recoverable diamonds. Eight amoeba cells are only a potential source until diamond conversion, survival, and access are verified. Lost or unreachable gems need an extra margin.

## Measure real containment

In `engine.mjs`, amoeba can grow into **both dirt and empty space**, excluding the occupied player cell. Digging a dirt moat therefore does not create a containment barrier. The existing `amoeba-access` proposals in `route-planner.mjs` are player-access opportunities, not enclosure achievements.

Useful containment features would include:

- Every amoeba component's boundary, counting both dirt and empty neighbors as possible growth; the engine shares size and conversion state across components.
- Solid obstacles and whether their arrangement survives subsequent gravity or player movement.
- Remaining growth openings and the actions required to close them while leaving the player an escape.
- Colony size and recoverable conversion yield, considered against the engine's growth limit.

Do not reward digging near the colony as though it reduced that boundary. A player temporarily occupying a growth cell is also not a permanent wall.

## Keep the retreat usable over time

Amoeba can block movement without immediate contact death. Distinguish proximity from a safe position: the player may survive beside the colony while its future retreat becomes obstructed. Once the player vacates an occupied cell, that cell can become a growth opportunity again. A currently connected return corridor can therefore become impassable.

Evaluate the approach and retreat against intervening growth and falling objects, rather than only current walkability or Manhattan distance. Recheck access after a wait, retain an alternative when possible, and avoid giving a one-way access dig the same credit as a sustainable work position. Growth into an empty approach does not mean digging made the cell newly growable; dirt was already growable too.

## Verify conversion, then harvest

The engine chooses diamond conversion when the amoeba has no growth opening; an oversized unconfined colony becomes rocks. Inspect the actual conversion state rather than assuming that waiting or reaching a certain size produces diamonds. Rocks do not receive pending-diamond credit.

After a verified diamond conversion, simulate settling objects, collection access, the remaining timer, and a route to the exit. Preserve an escape before closing the last growth opening. Enough theoretical supply, enough collected diamonds, and a real exit are three different milestones.

## Candidate validation work

Before changing rewards or adding a containment search, test invented layouts covering dirt versus solid boundaries, insufficient early conversion, oversized rock conversion, a temporary gravity-dependent enclosure, a released rock chasing the descent, growth reclaiming a vacated approach, and an escape route blocked by conversion or falling gems. Compare complete outcomes under the same input/search budget; a higher access or preparation score is not proof of better planning. Uncontained growth followed by rock conversion is a failed supply plan, even if the player survived to observe it.

Keep existing action values and replay inputs. Use a new expansion namespace only if the actual expansion rules change, and archive new completed trials separately. Reading these notes does not train the stored model. See [learning behavior](LEARNING.md) and [generation tests](../test/generation-planning.test.mjs).
