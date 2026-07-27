/**
 * @kernel/scheduling/domain/schedule — the temporal-allocation domain types.
 *
 * Re-exports the canonical `Schedule`, `ScheduleSlot`, `ScheduleWindow`,
 * `RecurrenceRule`, and `ScheduleStatus` primitives from `@kernel/shared-kernel`
 * so consumers of `@kernel/scheduling` see a single, cohesive surface. The
 * canonical *shape* lives in shared-kernel; this module owns the realised
 * domain helpers that operate on those shapes.
 *
 * All helpers are PURE: no `Date.now()`, no `Math.random()`, no I/O. They
 * operate solely on the epoch-millis numbers carried in by the caller (which
 * the caller sources from `ExecutionContext.clock.now()`).
 */

import type {
  Schedule,
  ScheduleSlot,
  ScheduleWindow,
  RecurrenceRule,
  ScheduleStatus,
  Capacity,
  ScheduleId,
  ResourceId,
} from "@kernel/shared-kernel";
import { asId } from "@kernel/shared-kernel";

// ── Canonical re-exports ───────────────────────────────────────────────────
export type {
  Schedule,
  ScheduleSlot,
  ScheduleWindow,
  RecurrenceRule,
  ScheduleStatus,
} from "@kernel/shared-kernel";

// ── Pure helpers ───────────────────────────────────────────────────────────

/**
 * Build a `ScheduleWindow` value object. Pure: just a typed constructor.
 *
 * @param start  epoch-millis (inclusive)
 * @param end    epoch-millis (exclusive)
 * @param timezone IANA timezone name (e.g. "UTC", "America/New_York")
 */
export function createScheduleWindow(
  start: number,
  end: number,
  timezone: string = "UTC"
): ScheduleWindow {
  return { start, end, timezone };
}

/**
 * Build a `ScheduleSlot` value object with a deterministic id derived from
 * `(scheduleId, start, end)`. Pure: no counter, no randomness — the same
 * inputs always yield the same slot id, so this is safe to call inside the
 * deterministic core.
 *
 * @param scheduleId parent schedule id
 * @param start      epoch-millis (inclusive)
 * @param end        epoch-millis (exclusive)
 * @param capacity   capacity envelope for this slot
 * @param resourceId optional owning resource (omitted for unassigned slots)
 */
export function createScheduleSlot(
  scheduleId: ScheduleId,
  start: number,
  end: number,
  capacity: Capacity,
  resourceId?: ResourceId
): ScheduleSlot {
  const id = asId<"ScheduleSlotId">(`${scheduleId}#${start}#${end}`);
  return resourceId === undefined
    ? { id, scheduleId, start, end, capacity }
    : { id, scheduleId, start, end, capacity, resourceId };
}

/**
 * Half-open interval overlap test on two slots: `[a.start, a.end)` ∩
 * `[b.start, b.end) ≠ ∅`. Resource identity is deliberately NOT considered —
 * callers wanting resource-scoped overlap should additionally compare
 * `resourceId`. Pure.
 */
export function slotsOverlap(a: ScheduleSlot, b: ScheduleSlot): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Whether `slot` is fully contained within `window` (half-open semantics):
 * `window.start <= slot.start && slot.end <= window.end`. Pure. Timezone is
 * ignored — callers should ensure both share a timezone before comparing
 * epoch-millis.
 */
export function isWithin(slot: ScheduleSlot, window: ScheduleWindow): boolean {
  return window.start <= slot.start && slot.end <= window.end;
}
