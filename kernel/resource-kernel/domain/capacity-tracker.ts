/**
 * @kernel/resource-kernel/domain/capacity-tracker — the CapacityTracker PORT.
 *
 * Tracks each resource's capacity envelope: the maximum load it can carry, the
 * current load (sum of all active reservations), the remaining headroom, plus
 * a journal of future-dated reservations so the Coordination Kernel can answer
 * "what's the projected remaining capacity at window W?".
 *
 * The tracker is the SOLE owner of the `currentLoad` number — the
 * AvailabilityEngine tracks state, the CapacityTracker tracks quantity.
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`. All
 * time flows through the `window` argument. Concrete implementations (in
 * `infrastructure/`) MUST honour this.
 */

import type { ResourceId } from "@kernel/shared-kernel";
import type { Quantity, TemporalWindow } from "@kernel/shared-kernel";
import type { Result, KernelError } from "@kernel/shared-kernel";

/**
 * A snapshot of a resource's capacity envelope at a point in time.
 */
export interface CapacityInfo {
  /** Maximum load the resource can carry. */
  readonly max: number;
  /** Unit of measure (e.g. "items", "hours", "kg", "seats"). */
  readonly unit: string;
  /** Sum of all active reservations. */
  readonly currentLoad: number;
  /** `max - currentLoad`, clamped at 0. */
  readonly remaining: number;
}

/**
 * A single future-dated reservation entry — used by `getFutureCapacity` to
 * project remaining capacity across a window.
 */
export interface CapacityReservation {
  readonly window: TemporalWindow;
  readonly quantity: Quantity;
}

/**
 * A projected remaining-capacity snapshot for a future window. The
 * `remaining` is the projected headroom at the START of `window` after
 * accounting for all reservations whose windows overlap.
 */
export interface FutureCapacitySnapshot {
  readonly window: TemporalWindow;
  readonly remaining: number;
}

/**
 * The CapacityTracker PORT.
 *
 * Implementations MUST be pure functions of `(resourceId, …)`. The same
 * sequence of `reserve` / `release` calls produces the same `currentLoad`.
 */
export interface CapacityTracker {
  /**
   * Returns the current capacity envelope for the resource, or `undefined` if
   * the resource has no capacity tracked.
   */
  getCapacity(resourceId: ResourceId): CapacityInfo | undefined;
  /**
   * Returns the current load (sum of active reservations). Returns `0` if the
   * resource has no capacity tracked.
   */
  getCurrentLoad(resourceId: ResourceId): number;
  /**
   * Returns the current remaining headroom (`max - currentLoad`, clamped at
   * `0`). Returns `0` if the resource has no capacity tracked.
   */
  getRemaining(resourceId: ResourceId): number;
  /**
   * Reserve `quantity` against the resource for `window`.
   *
   * Returns `err(LimitExceededError)` if the remaining capacity is
   * insufficient. Returns `err(ValidationError)` if `quantity.unit` does not
   * match the resource's capacity unit. On success, `currentLoad` is
   * incremented and the reservation is added to the future journal.
   */
  reserve(
    resourceId: ResourceId,
    quantity: Quantity,
    window: TemporalWindow
  ): Result<void, KernelError>;
  /**
   * Release `quantity` from the resource's current load (clamped at `0`).
   * Removes matching future reservations (FIFO order by start time).
   */
  release(resourceId: ResourceId, quantity: Quantity): void;
  /**
   * Returns the projected remaining-capacity snapshots for the resource
   * within `window`. Each snapshot is a future reservation's window paired
   * with the projected remaining at that point. Returns an empty array if the
   * resource has no capacity tracked or no future reservations overlap.
   */
  getFutureCapacity(
    resourceId: ResourceId,
    window: TemporalWindow
  ): readonly FutureCapacitySnapshot[];
}
