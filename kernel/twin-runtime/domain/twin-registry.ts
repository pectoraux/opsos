/**
 * @kernel/twin-runtime/domain/twin-registry — the TwinRegistry PORT.
 *
 * The registry holds the current `TwinState` for every entity. Updates
 * create a new versioned state and stamp `updatedAt = now`.
 *
 * Determinism rule: pure type — no `Date.now()`, no `Math.random()`. All
 * time flows through the `now` argument supplied by the caller.
 */

import type { TwinState } from "./twin-state";
import type { UnknownRecord } from "@kernel/shared-kernel";

/**
 * The TwinRegistry PORT. `updateState` increments the twin's `version` and
 * stamps `updatedAt = now`; returns the new `TwinState` or `undefined` if no
 * twin is registered for the entity.
 */
export interface TwinRegistry {
  register(state: TwinState): void;
  get(entityId: string): TwinState | undefined;
  list(): readonly TwinState[];
  updateState(entityId: string, state: UnknownRecord, now: number): TwinState | undefined;
  listByType(entityType: string): readonly TwinState[];
}
