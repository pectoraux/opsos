/**
 * @kernel/scheduling/domain/schedule-policy — declarative scheduling constraints.
 *
 * A `SchedulePolicy` is a bag of declarative, serialisable constraints that a
 * schedule MUST satisfy. It contains NO algorithm and NO functions — it is
 * pure data, so it can be replayed, audited, transported, and evaluated by any
 * (protocol-supplied) scheduler. Per ADR-0008 the kernel ships NO dispatch /
 * routing algorithm; the policy is the contract a real scheduler must honour.
 *
 * `validateSchedule` is a PURE function that checks the structural, generic
 * constraints (slot count per resource, slot duration bounds, required gaps,
 * allowed/excluded windows). Protocol-specific `constraints` (the generic
 * `Constraint[]` bag) are NOT evaluated here — they are interpreted by
 * protocol-supplied evaluators installed via the extension system. The
 * function returns the list of violation messages (empty = valid) wrapped in a
 * `Result`; an `err` is returned only if the policy itself is malformed (e.g.
 * `minSlotDurationMs > maxSlotDurationMs`).
 */

import type {
  Schedule,
  ScheduleSlot,
  ScheduleWindow,
  Constraint,
  KernelError,
  Result,
  TemporalWindow,
} from "@kernel/shared-kernel";
import { ValidationError, ok, err } from "@kernel/shared-kernel";
import { slotsOverlap, isWithin } from "./schedule";

/**
 * Declarative scheduling constraints — pure data, no algorithm.
 */
export interface SchedulePolicy {
  readonly id: string;
  readonly name: string;
  /** Max concurrent / total slots a single resource may carry in the schedule. */
  readonly maxSlotsPerResource: number;
  /** Minimum slot duration in ms (inclusive). */
  readonly minSlotDurationMs: number;
  /** Maximum slot duration in ms (inclusive). */
  readonly maxSlotDurationMs: number;
  /** Required gap (ms) between two slots on the same resource. */
  readonly requiredGapMs: number;
  /** Windows within which slots MUST fall (empty = no allow-list restriction). */
  readonly allowedWindows: readonly TemporalWindow[];
  /** Windows within which slots MUST NOT fall (overlap-forbidden). */
  readonly excludedWindows: readonly TemporalWindow[];
  /**
   * Protocol-specific constraints (generic `Constraint` bag). NOT evaluated by
   * `validateSchedule`; interpreted by protocol-supplied evaluators.
   */
  readonly constraints: readonly Constraint[];
}

/**
 * Validate `schedule` against `policy`. PURE.
 *
 * Returns `ok(violations)` where `violations` is the (possibly empty) list of
 * human-readable violation messages — empty means valid. Returns `err` only
 * when the policy itself is malformed (e.g. `minSlotDurationMs >
 * maxSlotDurationMs` or a negative bound), via a `ValidationError`.
 *
 * Generic `policy.constraints` are NOT evaluated here — they require a
 * protocol-specific evaluator (installed later via the extension system).
 */
export function validateSchedule(
  policy: SchedulePolicy,
  schedule: Schedule
): Result<readonly string[], KernelError> {
  // ── Policy self-consistency ────────────────────────────────────────────
  if (
    policy.minSlotDurationMs < 0 ||
    policy.maxSlotDurationMs < 0 ||
    policy.requiredGapMs < 0 ||
    policy.maxSlotsPerResource < 0
  ) {
    return err(
      new ValidationError(
        `SchedulePolicy '${policy.id}' has negative bounds`,
        [{ field: "bounds", reason: "negative-duration-or-count" }]
      )
    );
  }
  if (policy.minSlotDurationMs > policy.maxSlotDurationMs) {
    return err(
      new ValidationError(
        `SchedulePolicy '${policy.id}': minSlotDurationMs (${policy.minSlotDurationMs}) ` +
          `> maxSlotDurationMs (${policy.maxSlotDurationMs})`,
        [{ field: "minSlotDurationMs", reason: "exceeds-max" }]
      )
    );
  }

  const violations: string[] = [];
  const slots = schedule.slots;

  // ── Per-slot checks: duration bounds ───────────────────────────────────
  for (const slot of slots) {
    const durationMs = slot.end - slot.start;
    if (durationMs < policy.minSlotDurationMs) {
      violations.push(
        `slot '${slot.id}' duration ${durationMs}ms < minSlotDurationMs ${policy.minSlotDurationMs}ms`
      );
    }
    if (durationMs > policy.maxSlotDurationMs) {
      violations.push(
        `slot '${slot.id}' duration ${durationMs}ms > maxSlotDurationMs ${policy.maxSlotDurationMs}ms`
      );
    }
  }

  // ── Per-slot checks: allowed / excluded windows ────────────────────────
  if (policy.allowedWindows.length > 0) {
    for (const slot of slots) {
      const insideAtLeastOne = policy.allowedWindows.some((w) =>
        isWithin(slot, w)
      );
      if (!insideAtLeastOne) {
        violations.push(
          `slot '${slot.id}' is not within any allowedWindow`
        );
      }
    }
  }
  for (const slot of slots) {
    for (const xw of policy.excludedWindows) {
      if (overlapsWindow(slot, xw)) {
        violations.push(
          `slot '${slot.id}' overlaps excludedWindow [${xw.start},${xw.end})`
        );
      }
    }
  }

  // ── Per-resource checks: count + required gap ──────────────────────────
  const byResource = groupByResourceId(slots);
  for (const [resourceId, resourceSlots] of byResource) {
    if (resourceSlots.length > policy.maxSlotsPerResource) {
      violations.push(
        `resource '${resourceId}' has ${resourceSlots.length} slots > maxSlotsPerResource ${policy.maxSlotsPerResource}`
      );
    }
    // Pairwise required-gap check on the same resource. O(n²) on per-resource
    // slot count — schedules are bounded by policy, so this is acceptable.
    for (let i = 0; i < resourceSlots.length; i++) {
      for (let j = i + 1; j < resourceSlots.length; j++) {
        const a = resourceSlots[i];
        const b = resourceSlots[j];
        if (slotsOverlap(a, b)) {
          violations.push(
            `resource '${resourceId}': slots '${a.id}' and '${b.id}' overlap`
          );
        } else {
          const gap = a.end <= b.start ? b.start - a.end : a.start - b.end;
          if (gap < policy.requiredGapMs) {
            violations.push(
              `resource '${resourceId}': gap between '${a.id}' and '${b.id}' is ${gap}ms < requiredGapMs ${policy.requiredGapMs}ms`
            );
          }
        }
      }
    }
  }

  return ok(violations);
}

// ── Internal helpers ───────────────────────────────────────────────────────

/** Test whether `[slot.start, slot.end)` overlaps `[w.start, w.end)`. */
function overlapsWindow(slot: ScheduleSlot, w: ScheduleWindow): boolean {
  return slot.start < w.end && w.start < slot.end;
}

/** Group slots by `resourceId`; slots without a `resourceId` are skipped. */
function groupByResourceId(
  slots: readonly ScheduleSlot[]
): ReadonlyMap<string, ScheduleSlot[]> {
  const map = new Map<string, ScheduleSlot[]>();
  for (const s of slots) {
    if (s.resourceId === undefined) continue;
    const key = String(s.resourceId);
    const list = map.get(key);
    if (list === undefined) {
      map.set(key, [s]);
    } else {
      list.push(s);
    }
  }
  return map;
}
