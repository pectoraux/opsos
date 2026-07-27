/**
 * @kernel/resource-kernel/domain/availability-engine — the AvailabilityEngine
 * PORT.
 *
 * Owns the resource operational-state machine. Every resource at every point
 * in time is in exactly one `AvailabilityState`. The Coordination Kernel asks
 * "is this resource available for window W?" via this engine — it never
 * inspects raw state directly.
 *
 * State machine (FROZEN):
 *
 *   idle        — free, ready to accept new work
 *   busy        — currently performing work (may still accept future windows
 *                  subject to capacity / calendar)
 *   reserved    — capacity held for an upcoming window, not yet committed
 *   committed   — durable commitment to perform work in a window
 *   offline     — administratively offline; cannot accept work
 *   maintenance — under active maintenance; cannot accept work
 *   unavailable — temporarily unavailable (e.g. incident); cannot accept work
 *   degraded    — partially impaired; may still accept limited work
 *
 * Legal transitions (legal-transition table):
 *   idle        → { busy, reserved, offline, maintenance, unavailable }
 *   busy        → { idle, degraded }
 *   reserved    → { committed, idle }
 *   committed   → { idle, busy }
 *   offline     → { idle }
 *   maintenance → { idle }
 *   degraded    → { idle, busy }
 *   unavailable → { idle }
 *
 * Self-loops (state === state) are treated as legal no-ops. Illegal
 * transitions return `err(IllegalStateError)`.
 *
 * Determinism rule: this PORT is a pure interface — no `Date.now()`, no
 * `Math.random()`. `now` is supplied by the caller. Concrete implementations
 * (in `infrastructure/`) MUST honour this.
 */

import type { ResourceId } from "@kernel/shared-kernel";
import type { TemporalWindow } from "@kernel/shared-kernel";
import type { ResourceOperationalState } from "@kernel/shared-kernel";
import type { Result, KernelError } from "@kernel/shared-kernel";

/**
 * The 8 availability states. Aliased to the canonical
 * `ResourceOperationalState` from shared-kernel (M7 resource primitives) so
 * the kernel never duplicates a frozen vocabulary.
 */
export type AvailabilityState = ResourceOperationalState;

/**
 * States from which a resource may accept new work. Anything outside this set
 * (offline, maintenance, unavailable) is treated as a hard block — the
 * resource cannot be matched. (idle, reserved, busy, committed, degraded are
 * all "soft" — capacity / calendar / certification gates still apply, but the
 * state itself does not disqualify.)
 */
export const ACCEPTING_STATES: readonly AvailabilityState[] = [
  "idle",
  "reserved",
  "busy",
  "committed",
  "degraded",
];

/**
 * Hard-block states — resource cannot accept any work while in one of these.
 */
export const BLOCKED_STATES: readonly AvailabilityState[] = [
  "offline",
  "maintenance",
  "unavailable",
];

/**
 * The legal-transition table. `LEGAL_AVAILABILITY_TRANSITIONS[from]` is the
 * set of states `from` may transition to (excluding the implicit self-loop).
 */
export const LEGAL_AVAILABILITY_TRANSITIONS: Readonly<
  Record<AvailabilityState, readonly AvailabilityState[]>
> = {
  idle: ["busy", "reserved", "offline", "maintenance", "unavailable"],
  busy: ["idle", "degraded"],
  reserved: ["committed", "idle"],
  committed: ["idle", "busy"],
  offline: ["idle"],
  maintenance: ["idle"],
  degraded: ["idle", "busy"],
  unavailable: ["idle"],
};

/**
 * Total, deterministic transition guard. Returns `true` iff `from → to` is in
 * the legal-transition table (or `from === to`, treated as a legal no-op).
 */
export function canTransitionAvailability(
  from: AvailabilityState,
  to: AvailabilityState
): boolean {
  if (from === to) return true;
  return LEGAL_AVAILABILITY_TRANSITIONS[from].includes(to);
}

/**
 * Returns `true` if `state` is a hard-block state (resource cannot accept any
 * work).
 */
export function isBlocked(state: AvailabilityState): boolean {
  return BLOCKED_STATES.includes(state);
}

/**
 * The AvailabilityEngine PORT.
 *
 * Implementations MUST be pure functions of `(resourceId, …, now)`. Identical
 * inputs produce identical results — no hidden state beyond the engine's own
 * internal map of `resourceId → state`.
 */
export interface AvailabilityEngine {
  /** Returns the resource's current state (defaults to `"idle"` if unknown). */
  getState(resourceId: ResourceId): AvailabilityState;
  /** Force-sets the state (no transition check). Used for bootstrap / repair. */
  setState(resourceId: ResourceId, state: AvailabilityState, now: number): void;
  /**
   * Returns `true` iff the resource is in an accepting state at `now` AND the
   * `window` does not fall inside a hard-block period. The in-memory engine
   * treats this as `!isBlocked(state)`; richer engines may consult the
   * resource's calendar / maintenance schedule.
   */
  isAvailable(
    resourceId: ResourceId,
    window: TemporalWindow,
    now: number
  ): boolean;
  /**
   * Attempt a state transition. Returns `err(IllegalStateError)` if the
   * transition is not in the legal-transition table. On success, the engine's
   * internal state is updated and `ok(undefined)` is returned.
   */
  transition(
    resourceId: ResourceId,
    to: AvailabilityState,
    now: number
  ): Result<void, KernelError>;
}
