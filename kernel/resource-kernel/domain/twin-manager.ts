/**
 * @kernel/resource-kernel/domain/twin-manager — the TwinManager PORT.
 *
 * Every resource has a digital twin — the kernel's modeled representation of
 * the real-world resource. The twin carries:
 *   - the canonical `Twin` primitive (from M1, frozen) — the protocol-facing
 *     state model
 *   - a history of `TwinState` snapshots — temporal log of (state, telemetry)
 *     at each update
 *   - a telemetry journal — appended `Telemetry` readings (M7 primitive)
 *   - predictions — protocol-supplied forward projections (initially empty;
 *     protocols install via the in-memory class's `setPredictions` helper)
 *
 * The Coordination Kernel queries the twin to answer "what is resource R's
 * current state?" without coupling to the resource's concrete type. The
 * compiler / runtime reason against twins, NOT resources.
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`. All
 * time flows through the `now` argument.
 */

import type { ResourceId, TwinId } from "@kernel/shared-kernel";
import type {
  Twin,
  Telemetry,
  UnknownRecord,
} from "@kernel/shared-kernel";

/**
 * A historical snapshot of a twin's state at a point in time. The
 * `telemetry` field carries the telemetry readings observed at or before
 * `updatedAt`.
 */
export interface TwinState {
  readonly resourceId: ResourceId;
  readonly state: UnknownRecord;
  readonly updatedAt: number;
  readonly telemetry: readonly Telemetry[];
}

/**
 * A protocol-supplied forward projection for a twin. The kernel itself never
 * predicts — protocols register predictions via the in-memory class's
 * `setPredictions` helper. Each prediction has a horizon and a projected
 * state.
 */
export interface TwinPrediction {
  readonly resourceId: ResourceId;
  readonly horizon: number;
  readonly state: UnknownRecord;
  readonly confidence: number;
}

/**
 * The TwinManager PORT.
 *
 * Implementations MUST be pure functions of `(resourceId, …, now)`. The twin
 * is mutated only via `updateState` / `addTelemetry` — both deterministic
 * functions of their inputs.
 */
export interface TwinManager {
  /**
   * Returns the resource's current `Twin`, or `undefined` if none has been
   * initialised.
   */
  getTwin(resourceId: ResourceId): Twin | undefined;
  /**
   * Updates the twin's modeled state and stamps `updatedAt = now`. A snapshot
   * is appended to the history journal. If no twin exists for the resource,
   * one is lazily initialised with a deterministic `TwinId` derived from
   * `resourceId` and a default `modelType` of `"resource"`.
   */
  updateState(resourceId: ResourceId, state: UnknownRecord, now: number): void;
  /**
   * Appends a telemetry reading to the twin's journal. The reading's
   * `resourceId` MUST match; if not, the call is a no-op (defensive).
   */
  addTelemetry(resourceId: ResourceId, reading: Telemetry): void;
  /**
   * Returns the history of `TwinState` snapshots whose `updatedAt` falls in
   * `[from, to]` (inclusive both ends), ordered ascending by `updatedAt`.
   */
  getHistory(
    resourceId: ResourceId,
    from: number,
    to: number
  ): readonly TwinState[];
  /**
   * Returns the protocol-supplied predictions for the resource. Empty by
   * default — protocols install predictions via the in-memory class's
   * `setPredictions` helper.
   */
  getPredictions(resourceId: ResourceId): readonly TwinPrediction[];
}

/**
 * Construct a deterministic `TwinId` from a `ResourceId`. Format:
 * `twin#${resourceId}`. Exposed so protocol layers can reproduce ids.
 */
export function computeTwinId(resourceId: ResourceId): TwinId {
  return `twin#${resourceId}` as unknown as TwinId;
}
