/**
 * @kernel/projections/domain/projection-rebuilder — the ProjectionRebuilder PORT.
 *
 * The rebuilder replays ALL events from an `EventStore` to rebuild one (or all)
 * projection's read models from scratch. Used for catch-up after downtime,
 * schema migrations, or seeding a fresh store.
 *
 * Rebuild semantics:
 *   1. `clear(projectionId)` — discard all existing read models for the projection.
 *   2. Iterate `eventStore.readAll()`; for each matching event, derive the key,
 *      load the current state (or `initialState`), apply, and put.
 *
 * The rebuilder is NOT pure (it performs I/O via the store + event store), but
 * the per-event transition is the PURE `applyEvent` use-case. No
 * `Date.now()` / `Math.random()` — all time comes from event envelopes.
 */

import type { ProjectionId } from "@kernel/shared-kernel";
import type { EventStore } from "@kernel/events";
import type { ProjectionApplyContext } from "./projection-definition";

/** Result of a rebuild operation. */
export interface ProjectionRebuildResult {
  /** Number of events that matched at least one projection's `sourceEventTypes`. */
  readonly processed: number;
}

/**
 * Port: rebuilds projection read models by replaying the event store.
 */
export interface ProjectionRebuilder {
  /**
   * Rebuild ONE projection's read models from scratch by replaying all events.
   * Clears existing read models for the projection first. Returns
   * `{ processed: 0 }` if the projection id is not registered.
   */
  rebuild(
    projectionId: ProjectionId,
    eventStore: EventStore,
    ctx: ProjectionApplyContext
  ): Promise<ProjectionRebuildResult>;
  /**
   * Rebuild ALL registered projections from scratch by replaying all events.
   * Clears each projection's read models first.
   */
  rebuildAll(
    eventStore: EventStore,
    ctx: ProjectionApplyContext
  ): Promise<ProjectionRebuildResult>;
}
