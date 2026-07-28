/**
 * @kernel/projections/domain/projection-engine — the ProjectionEngine PORT.
 *
 * The engine registers projection definitions, applies live events to matching
 * projections, and subscribes to an `EventStore`'s live stream. It is the
 * CQRS read-side motor: events flow in → read models materialise out.
 *
 * The engine is NOT a pure function — it coordinates I/O (load/put read models,
 * subscribe to the store). The PURE core lives in `ProjectionDefinition.apply`
 * and the `applyEvent` use-case wrapper in the application layer.
 */

import type { ProjectionId } from "@kernel/shared-kernel";
import type {
  EventEnvelope,
  EventStore,
  Subscription,
} from "@kernel/events";
import type {
  ProjectionDefinition,
  ProjectionApplyContext,
} from "./projection-definition";

/**
 * Port: the projection engine.
 *
 * `handle` applies ONE live event to every registered projection whose
 * `sourceEventTypes` includes the event's type. `start` wires the engine to an
 * `EventStore`'s live stream via `subscribe`.
 */
export interface ProjectionEngine {
  /**
   * Register a projection definition. Idempotent by `definition.id` —
   * re-registering with the same id replaces the prior definition.
   */
  register<TState>(definition: ProjectionDefinition<TState>): void;
  /** Unregister a projection definition by id. No-op if not registered. */
  unregister(projectionId: ProjectionId): void;
  /**
   * Apply a single live event to all matching registered projections.
   *
   * For each matching projection (in registration order): derive the key
   * (default `"all"`), load the current state from the store (or
   * `initialState`), apply the definition's `apply`, and put the updated read
   * model back. Errors from a projection's `apply` propagate to the caller.
   */
  handle(
    event: EventEnvelope,
    ctx: ProjectionApplyContext
  ): Promise<void>;
  /**
   * Subscribe the engine to an `EventStore`'s live stream. Every appended event
   * is forwarded to `handle` with a per-event context derived from the event's
   * metadata. Returns the underlying subscription so callers can unsubscribe.
   *
   * Per-event errors from a projection's `apply` are contained so a single
   * faulty projection cannot kill the live subscription.
   */
  start(eventStore: EventStore): Subscription;
  /** Snapshot of all currently registered definitions (registration order). */
  list(): readonly ProjectionDefinition[];
}
