/**
 * @kernel/projections/domain/projection-store — the ProjectionStore PORT +
 * ReadModel + ProjectionQuery.
 *
 * The `ProjectionStore` persists read models keyed by `(projectionId, key)`.
 * Read models are written ONLY by the projection engine/rebuilder; query code
 * reads them WITHOUT mutation.
 *
 * Determinism: `ReadModel.lastEventVersion` is the per-stream `version` of the
 * last event applied to this read model (sourced from the event envelope —
 * never `Date.now()`). `updatedAt` is the `timestamp` of that event
 * (clock-sourced at event-creation time). Neither field is wall-clock-derived
 * inside this module.
 */

import type { ProjectionId } from "@kernel/shared-kernel";

/**
 * A materialised read model. Immutable snapshot of a projection's state for a
 * given key at a given event version.
 *
 * Implementations MUST treat `ReadModel` instances as immutable. Query results
 * MUST be defensive copies so callers cannot mutate the store's internal state.
 */
export interface ReadModel<TState = unknown> {
  /** The projection this read model belongs to. */
  readonly projectionId: ProjectionId;
  /** `"all"` for singletons, or an entity key derived via `keyFor`. */
  readonly key: string;
  /** The materialised state. */
  readonly state: TState;
  /** Per-stream `version` of the last event applied (from the envelope). */
  readonly lastEventVersion: number;
  /** `timestamp` of the last event applied (clock-sourced at emit time). */
  readonly updatedAt: number;
}

/** Query spec for `ProjectionStore.query`. */
export interface ProjectionQuery {
  readonly projectionId: ProjectionId;
  /** Optional key filter. Omit to return all keys for the projection. */
  readonly key?: string;
  /** Optional limit on the number of results (non-negative). */
  readonly limit?: number;
}

/**
 * Port: persistence for materialised read models.
 *
 * `put` REPLACES (not merges) the entry at `(projectionId, key)`. Query results
 * MUST be defensive copies. `clear` discards ALL read models for a projection
 * (used by the rebuilder).
 */
export interface ProjectionStore {
  /** Load a single read model by `(projectionId, key)`. Returns null if absent. */
  get<TState = unknown>(
    projectionId: ProjectionId,
    key: string
  ): Promise<ReadModel<TState> | null>;
  /** Upsert a read model (replaces any existing entry at the same key). */
  put<TState = unknown>(model: ReadModel<TState>): Promise<void>;
  /** Query read models for a projection. Supports optional key + limit filters. */
  query<TState = unknown>(
    q: ProjectionQuery
  ): Promise<readonly ReadModel<TState>[]>;
  /** Delete a single read model by `(projectionId, key)`. No-op if absent. */
  delete(projectionId: ProjectionId, key: string): Promise<void>;
  /** Delete ALL read models for a projection. Used by the rebuilder. */
  clear(projectionId: ProjectionId): Promise<void>;
}
