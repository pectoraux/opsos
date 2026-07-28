/**
 * @kernel/twin-runtime/domain/twin-state — the TwinState + TwinSnapshot value
 * objects.
 *
 * `TwinState` is the live, versioned current state of an entity's digital
 * twin. `TwinSnapshot` is an immutable point-in-time capture of an entity's
 * state + telemetry + health — appended to the HistoryStore on every
 * meaningful change.
 *
 * Determinism rule: pure types + pure helpers — no `Date.now()`, no
 * `Math.random()`. All time flows through the `now` argument supplied by the
 * caller.
 */

import type { UnknownRecord } from "@kernel/shared-kernel";

/**
 * The live current state of an entity's digital twin. `version` is monotonic
 * (incremented on every `updateState`); `fidelity` is a caller-supplied
 * trust score in [0, 1].
 */
export interface TwinState {
  readonly id: string;
  readonly entityId: string;
  readonly entityType: string;
  readonly currentState: UnknownRecord;
  readonly version: number;
  /** Epoch-millis from the RuntimeClock / `now` argument. */
  readonly updatedAt: number;
  /** Caller-supplied fidelity in [0, 1] — how accurate the twin is believed to be. */
  readonly fidelity: number;
}

/**
 * An immutable point-in-time capture of a twin's state + telemetry + health.
 * Appended to the HistoryStore on every meaningful change. `telemetry` is a
 * flat `metric → value` map (latest reading per metric at snapshot time).
 */
export interface TwinSnapshot {
  readonly entityId: string;
  readonly state: UnknownRecord;
  readonly telemetry: Readonly<Record<string, number>>;
  readonly healthScore: number;
  readonly timestamp: number;
}

/** Default fidelity for a freshly registered twin. */
export const DEFAULT_TWIN_FIDELITY = 0.8;

/** Clamp a fidelity / health / confidence / quality value into [0, 1]. */
export function clampUnit(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
