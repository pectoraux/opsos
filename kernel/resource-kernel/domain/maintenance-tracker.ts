/**
 * @kernel/resource-kernel/domain/maintenance-tracker — the MaintenanceTracker
 * PORT.
 *
 * Tracks scheduled, in-progress, and completed maintenance for each resource.
 * A resource in active maintenance is hard-blocked by the AvailabilityEngine
 * (state `"maintenance"`). The tracker is the SOLE source of truth for "is R
 * under maintenance at time T?".
 *
 * Maintenance status flow (FROZEN):
 *   scheduled → in-progress → completed
 *   scheduled → cancelled
 *   in-progress → cancelled (emergency abort)
 *
 * Self-loops are legal no-ops. Illegal transitions throw `IllegalStateError`.
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`. All
 * time flows through the `now` argument.
 */

import type { ResourceId, MaintenanceId } from "@kernel/shared-kernel";
import type { Maintenance, TemporalWindow } from "@kernel/shared-kernel";

/**
 * The legal maintenance-status transitions. Self-loops are implicit.
 */
export const LEGAL_MAINTENANCE_TRANSITIONS: Readonly<
  Record<Maintenance["status"], readonly Maintenance["status"][]>
> = {
  scheduled: ["in-progress", "cancelled"],
  "in-progress": ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/**
 * Total, deterministic transition guard for maintenance status.
 */
export function canTransitionMaintenance(
  from: Maintenance["status"],
  to: Maintenance["status"]
): boolean {
  if (from === to) return true;
  return LEGAL_MAINTENANCE_TRANSITIONS[from].includes(to);
}

/**
 * Input for scheduling a new maintenance window.
 */
export interface MaintenanceScheduleInput {
  readonly resourceId: ResourceId;
  readonly window: TemporalWindow;
  readonly type: Maintenance["type"];
  readonly description: string;
  readonly now: number;
}

/**
 * The MaintenanceTracker PORT.
 */
export interface MaintenanceTracker {
  /**
   * Schedules a new maintenance window. Mints a deterministic `MaintenanceId`
   * from `resourceId` + `now` + a per-instance counter. Returns the created
   * `Maintenance` record (status `"scheduled"`).
   */
  schedule(input: MaintenanceScheduleInput): Maintenance;
  /**
   * Starts a scheduled maintenance (→ `"in-progress"`). Returns the updated
   * record. Throws `IllegalStateError` if the current status is not
   * `"scheduled"`.
   */
  start(maintenanceId: MaintenanceId, now: number): Maintenance;
  /**
   * Completes an in-progress maintenance (→ `"completed"`). Returns the
   * updated record. Throws `IllegalStateError` if the current status is not
   * `"in-progress"`.
   */
  complete(maintenanceId: MaintenanceId, now: number): Maintenance;
  /**
   * Cancels a non-terminal maintenance (→ `"cancelled"`). Idempotent on
   * `"cancelled"`. Throws `IllegalStateError` if the current status is
   * `"completed"`.
   */
  cancel(maintenanceId: MaintenanceId, now: number): Maintenance;
  /**
   * Returns all scheduled (not yet started) maintenance for the resource,
   * ordered by window.start ascending.
   */
  getScheduled(resourceId: ResourceId): readonly Maintenance[];
  /**
   * Returns all maintenance records for the resource (any status), ordered by
   * window.start ascending.
   */
  getAll(resourceId: ResourceId): readonly Maintenance[];
  /**
   * Returns `true` iff the resource has an `"in-progress"` maintenance OR a
   * `"scheduled"` maintenance whose window contains `now`.
   */
  isInMaintenance(resourceId: ResourceId, now: number): boolean;
}
