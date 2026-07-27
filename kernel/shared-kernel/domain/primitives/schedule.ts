/**
 * @kernel/shared-kernel/domain/primitives/schedule — the temporal-allocation
 * canonical primitives.
 *
 *   Route · Schedule · ScheduleSlot
 *
 * Realised by `@kernel/scheduling`. The kernel ships the *types* and a
 * `Scheduler` PORT only — no dispatch/routing algorithm (see ADR-0008).
 */

import type {
  RouteId,
  TaskId,
  ResourceId,
  ScheduleId,
  ScheduleSlotId,
} from "../identifiers";
import type { Capacity, Constraint } from "../value-objects";
import type { ScheduleWindow, RecurrenceRule } from "../temporal";

// ── 14. Schedule ────────────────────────────────────────────────────────────

export type ScheduleStatus = "draft" | "active" | "locked" | "completed" | "cancelled";

export interface ScheduleSlot {
  readonly id: ScheduleSlotId;
  readonly scheduleId: ScheduleId;
  readonly start: number;
  readonly end: number;
  readonly resourceId?: ResourceId;
  readonly capacity: Capacity;
}

export interface Schedule {
  readonly id: ScheduleId;
  readonly window: ScheduleWindow;
  readonly slots: readonly ScheduleSlot[];
  readonly recurrence?: RecurrenceRule;
  readonly status: ScheduleStatus;
}

// ── 13. Route ───────────────────────────────────────────────────────────────

export type RouteStatus = "planned" | "assigned" | "active" | "completed" | "failed";

export interface Route {
  readonly id: RouteId;
  readonly taskId: TaskId;
  readonly resourceId: ResourceId;
  readonly scheduleSlotId: ScheduleSlotId;
  readonly sequence: number;
  readonly constraints: readonly Constraint[];
  readonly status: RouteStatus;
}
