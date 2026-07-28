/**
 * @kernel/resource-kernel/application/reserve-capacity — the use-case that
 * reserves capacity on a resource for a temporal window.
 *
 * Wraps `CapacityTracker.reserve` with a coarse outcome enum and a
 * diagnostics bag. Returns `"reserved"` on success, `"no-capacity"` on
 * `LimitExceededError`, `"not-found"` when the resource has no capacity
 * tracked, and `"failed"` for any other error (returned as a diagnostic).
 *
 * Optionally also transitions the resource's availability state to
 * `"reserved"` (when `transitionAvailability` is `true` and the resource is
 * currently `"idle"`). This keeps the AvailabilityEngine and CapacityTracker
 * in sync without coupling them.
 *
 * Determinism rule: identical inputs + identical engines → identical outputs.
 */

import type { ResourceId } from "@kernel/shared-kernel";
import type { Quantity, TemporalWindow } from "@kernel/shared-kernel";
import type { CapacityTracker, AvailabilityEngine } from "../domain";

/**
 * The input to `ReserveCapacity.execute`. Pure data.
 */
export interface ReserveCapacityInput {
  readonly resourceId: ResourceId;
  readonly quantity: Quantity;
  readonly window: TemporalWindow;
  /** Clock-sourced epoch-millis. */
  readonly now: number;
  /**
   * When `true`, the use-case also calls
   * `availability.transition(resourceId, "reserved", now)` if the resource is
   * currently `"idle"`. Default: `false`.
   */
  readonly transitionAvailability?: boolean;
}

/**
 * Coarse outcome of the reserve operation.
 *   - `"reserved"`     — capacity reserved successfully.
 *   - `"no-capacity"`  — remaining capacity insufficient.
 *   - `"not-found"`    — resource has no capacity tracked.
 *   - `"unit-mismatch"` — `quantity.unit` does not match the resource's
 *                          capacity unit.
 *   - `"failed"`       — any other failure (returned as a diagnostic).
 */
export type ReserveCapacityOutcome =
  | "reserved"
  | "no-capacity"
  | "not-found"
  | "unit-mismatch"
  | "failed";

/**
 * The result of `ReserveCapacity.execute`.
 */
export interface ReserveCapacityResult {
  readonly outcome: ReserveCapacityOutcome;
  /** Remaining capacity after the reservation (0 if not tracked). */
  readonly remaining: number;
  readonly diagnostics: readonly string[];
}

/**
 * The use-case PORT.
 */
export interface ReserveCapacity {
  execute(input: ReserveCapacityInput): ReserveCapacityResult;
}

/**
 * Default implementation.
 */
export class ReserveCapacityUseCase implements ReserveCapacity {
  constructor(
    private readonly capacity: CapacityTracker,
    private readonly availability?: AvailabilityEngine
  ) {}

  execute(input: ReserveCapacityInput): ReserveCapacityResult {
    const diagnostics: string[] = [];
    const info = this.capacity.getCapacity(input.resourceId);
    if (!info) {
      diagnostics.push(
        `reserve: resource '${input.resourceId}' has no capacity tracked`
      );
      return { outcome: "not-found", remaining: 0, diagnostics };
    }

    if (info.unit !== input.quantity.unit) {
      diagnostics.push(
        `reserve: unit mismatch — resource unit '${info.unit}', requested '${input.quantity.unit}'`
      );
      return { outcome: "unit-mismatch", remaining: info.remaining, diagnostics };
    }

    const result = this.capacity.reserve(
      input.resourceId,
      input.quantity,
      input.window
    );
    if (!result.ok) {
      const code = result.error.code;
      if (code === "LIMIT_EXCEEDED") {
        diagnostics.push(
          `reserve: insufficient capacity — remaining ${info.remaining}, requested ${input.quantity.amount}`
        );
        return {
          outcome: "no-capacity",
          remaining: info.remaining,
          diagnostics,
        };
      }
      diagnostics.push(
        `reserve: failed — ${result.error.message} (code=${code})`
      );
      return {
        outcome: "failed",
        remaining: info.remaining,
        diagnostics,
      };
    }

    const after = this.capacity.getCapacity(input.resourceId);
    const remaining = after ? after.remaining : 0;
    diagnostics.push(
      `reserve: ${input.quantity.amount} ${input.quantity.unit} on '${input.resourceId}' (remaining ${remaining})`
    );

    if (input.transitionAvailability && this.availability) {
      const state = this.availability.getState(input.resourceId);
      if (state === "idle") {
        const t = this.availability.transition(
          input.resourceId,
          "reserved",
          input.now
        );
        if (t.ok) {
          diagnostics.push(
            `reserve: availability transitioned idle → reserved`
          );
        } else {
          diagnostics.push(
            `reserve: availability transition failed — ${t.error.message}`
          );
        }
      }
    }

    return { outcome: "reserved", remaining, diagnostics };
  }
}
