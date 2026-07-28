/**
 * @kernel/resource-kernel/infrastructure/in-memory-capacity-tracker — the
 * in-memory `CapacityTracker` implementation.
 *
 * Pure data structure: a `Map<ResourceId, CapacityEntry>` where
 * `CapacityEntry` holds `{ max, unit, currentLoad, future }` and `future` is
 * an ordered list of `{ window, quantity }` reservations.
 *
 * No `Date.now()`, no `Math.random()`. All time flows through the `window`
 * argument.
 *
 * Semantics:
 *   - `reserve(qty, w)`  — if `qty.unit !== entry.unit` → `ValidationError`.
 *                          If `qty.amount > remaining` → `LimitExceededError`.
 *                          Else: `currentLoad += qty.amount`; append
 *                          `{window: w, quantity: qty}` to `future` (sorted
 *                          by `window.start`).
 *   - `release(qty)`     — `currentLoad = max(0, currentLoad - qty.amount)`.
 *                          Evict the earliest-starting future reservation
 *                          whose quantity matches (best-effort).
 *   - `getFutureCapacity(w)` — returns one snapshot per future reservation
 *                               whose window overlaps `w`, with the projected
 *                               remaining at that reservation's start.
 */

import {
  IllegalStateError,
  LimitExceededError,
  ValidationError,
} from "@kernel/shared-kernel";
import type { ResourceId } from "@kernel/shared-kernel";
import type { Quantity, TemporalWindow } from "@kernel/shared-kernel";
import type {
  CapacityTracker,
  CapacityInfo,
  CapacityReservation,
  FutureCapacitySnapshot,
} from "../domain";

interface CapacityEntry {
  max: number;
  unit: string;
  currentLoad: number;
  future: CapacityReservation[];
}

export class InMemoryCapacityTracker implements CapacityTracker {
  private readonly entries = new Map<ResourceId, CapacityEntry>();

  /**
   * Sets / replaces the capacity envelope for a resource. Call this when a
   * resource is registered (the InMemoryResourceKernel bundle wires this).
   */
  setCapacity(resourceId: ResourceId, max: number, unit: string): void {
    this.entries.set(resourceId, {
      max,
      unit,
      currentLoad: 0,
      future: [],
    });
  }

  getCapacity(resourceId: ResourceId): CapacityInfo | undefined {
    const entry = this.entries.get(resourceId);
    if (!entry) return undefined;
    const remaining = Math.max(0, entry.max - entry.currentLoad);
    return {
      max: entry.max,
      unit: entry.unit,
      currentLoad: entry.currentLoad,
      remaining,
    };
  }

  getCurrentLoad(resourceId: ResourceId): number {
    const entry = this.entries.get(resourceId);
    return entry ? entry.currentLoad : 0;
  }

  getRemaining(resourceId: ResourceId): number {
    const entry = this.entries.get(resourceId);
    if (!entry) return 0;
    return Math.max(0, entry.max - entry.currentLoad);
  }

  reserve(
    resourceId: ResourceId,
    quantity: Quantity,
    window: TemporalWindow
  ): ReturnType<CapacityTracker["reserve"]> {
    let entry = this.entries.get(resourceId);
    if (!entry) {
      return {
        ok: false,
        error: new IllegalStateError(
          `Resource '${resourceId}' has no capacity tracked`
        ),
      };
    }
    if (quantity.unit !== entry.unit) {
      return {
        ok: false,
        error: new ValidationError(
          `Unit mismatch on resource '${resourceId}': capacity unit is '${entry.unit}', reservation unit is '${quantity.unit}'`,
          [
            {
              field: "quantity.unit",
              reason: `expected '${entry.unit}', got '${quantity.unit}'`,
            },
          ]
        ),
      };
    }
    const remaining = Math.max(0, entry.max - entry.currentLoad);
    if (quantity.amount > remaining) {
      return {
        ok: false,
        error: new LimitExceededError(
          `Insufficient capacity on resource '${resourceId}': remaining ${remaining}, requested ${quantity.amount}`
        ),
      };
    }
    entry = {
      ...entry,
      currentLoad: entry.currentLoad + quantity.amount,
      future: [...entry.future, { window, quantity }].sort(
        (a, b) => a.window.start - b.window.start
      ),
    };
    this.entries.set(resourceId, entry);
    return { ok: true, value: undefined };
  }

  release(resourceId: ResourceId, quantity: Quantity): void {
    const entry = this.entries.get(resourceId);
    if (!entry) return;
    const newLoad = Math.max(0, entry.currentLoad - quantity.amount);
    // Evict the earliest-starting future reservation whose quantity matches.
    let evicted = false;
    const newFuture = entry.future.filter((r) => {
      if (evicted) return true;
      if (
        r.quantity.amount === quantity.amount &&
        r.quantity.unit === quantity.unit
      ) {
        evicted = true;
        return false;
      }
      return true;
    });
    this.entries.set(resourceId, {
      ...entry,
      currentLoad: newLoad,
      future: newFuture,
    });
  }

  getFutureCapacity(
    resourceId: ResourceId,
    window: TemporalWindow
  ): readonly FutureCapacitySnapshot[] {
    const entry = this.entries.get(resourceId);
    if (!entry) return [];
    const snapshots: FutureCapacitySnapshot[] = [];
    let runningLoad = entry.currentLoad;
    for (const r of entry.future) {
      // Include reservations whose windows overlap `window`.
      if (
        r.window.start < window.end &&
        r.window.end > window.start
      ) {
        const projectedRemaining = Math.max(0, entry.max - runningLoad);
        snapshots.push({
          window: r.window,
          remaining: projectedRemaining,
        });
      }
      // Accumulate load for reservations starting within or before the
      // query window (so later snapshots reflect prior commitments).
      if (r.window.start <= window.end) {
        runningLoad += r.quantity.amount;
      }
    }
    return snapshots;
  }
}
