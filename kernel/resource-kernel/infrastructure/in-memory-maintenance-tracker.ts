/**
 * @kernel/resource-kernel/infrastructure/in-memory-maintenance-tracker — the
 * in-memory `MaintenanceTracker` implementation.
 *
 * Pure data structures: a `Map<MaintenanceId, Maintenance>` plus a
 * `Map<ResourceId, MaintenanceId[]>` index. No `Date.now()`, no `Math.random()`.
 * Ids are minted deterministically: `maint#${resourceId}#${now}#${counter}`.
 *
 * Status flow: scheduled → in-progress → completed | cancelled. Illegal
 * transitions throw `IllegalStateError`.
 */

import { asId, IllegalStateError } from "@kernel/shared-kernel";
import type {
  ResourceId,
  MaintenanceId,
} from "@kernel/shared-kernel";
import type { Maintenance, TemporalWindow } from "@kernel/shared-kernel";
import type {
  MaintenanceTracker,
  MaintenanceScheduleInput,
} from "../domain";

function windowContains(window: TemporalWindow, t: number): boolean {
  return t >= window.start && t <= window.end;
}

export class InMemoryMaintenanceTracker implements MaintenanceTracker {
  private counter = 0;
  private readonly records = new Map<MaintenanceId, Maintenance>();
  private readonly byResource = new Map<ResourceId, MaintenanceId[]>();

  schedule(input: MaintenanceScheduleInput): Maintenance {
    this.counter += 1;
    const id = asId<"MaintenanceId">(
      `maint#${input.resourceId}#${input.now}#${this.counter}`
    );
    const record: Maintenance = {
      id,
      resourceId: input.resourceId,
      window: input.window,
      type: input.type,
      status: "scheduled",
      description: input.description,
    };
    this.records.set(id, record);
    const list = this.byResource.get(input.resourceId) ?? [];
    list.push(id);
    this.byResource.set(input.resourceId, list);
    return record;
  }

  start(maintenanceId: MaintenanceId, _now: number): Maintenance {
    const current = this.records.get(maintenanceId);
    if (!current) {
      throw new IllegalStateError(
        `Maintenance '${maintenanceId}' not found`
      );
    }
    if (current.status !== "scheduled") {
      throw new IllegalStateError(
        `Maintenance '${maintenanceId}' cannot be started from status '${current.status}'`
      );
    }
    const updated: Maintenance = { ...current, status: "in-progress" };
    this.records.set(maintenanceId, updated);
    return updated;
  }

  complete(maintenanceId: MaintenanceId, _now: number): Maintenance {
    const current = this.records.get(maintenanceId);
    if (!current) {
      throw new IllegalStateError(
        `Maintenance '${maintenanceId}' not found`
      );
    }
    if (current.status !== "in-progress") {
      throw new IllegalStateError(
        `Maintenance '${maintenanceId}' cannot be completed from status '${current.status}'`
      );
    }
    const updated: Maintenance = { ...current, status: "completed" };
    this.records.set(maintenanceId, updated);
    return updated;
  }

  cancel(maintenanceId: MaintenanceId, _now: number): Maintenance {
    const current = this.records.get(maintenanceId);
    if (!current) {
      throw new IllegalStateError(
        `Maintenance '${maintenanceId}' not found`
      );
    }
    if (current.status === "completed") {
      throw new IllegalStateError(
        `Maintenance '${maintenanceId}' cannot be cancelled from status 'completed'`
      );
    }
    if (current.status === "cancelled") return current; // idempotent
    const updated: Maintenance = { ...current, status: "cancelled" };
    this.records.set(maintenanceId, updated);
    return updated;
  }

  getScheduled(resourceId: ResourceId): readonly Maintenance[] {
    const ids = this.byResource.get(resourceId) ?? [];
    return ids
      .map((id) => this.records.get(id))
      .filter((m): m is Maintenance => Boolean(m))
      .filter((m) => m.status === "scheduled")
      .sort((a, b) => a.window.start - b.window.start);
  }

  getAll(resourceId: ResourceId): readonly Maintenance[] {
    const ids = this.byResource.get(resourceId) ?? [];
    return ids
      .map((id) => this.records.get(id))
      .filter((m): m is Maintenance => Boolean(m))
      .sort((a, b) => a.window.start - b.window.start);
  }

  isInMaintenance(resourceId: ResourceId, now: number): boolean {
    const ids = this.byResource.get(resourceId) ?? [];
    return ids.some((id) => {
      const m = this.records.get(id);
      if (!m) return false;
      if (m.status === "in-progress") return true;
      if (m.status === "scheduled" && windowContains(m.window, now)) return true;
      return false;
    });
  }
}
