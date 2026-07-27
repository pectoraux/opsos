/**
 * @kernel/resource-kernel/infrastructure/in-memory-resource-calendar — the
 * in-memory `ResourceCalendar` implementation.
 *
 * Pure data structure: a `Map<ResourceId, Calendar>`. No `Date.now()`, no
 * `Math.random()`. All time flows through the `window` / `now` arguments.
 *
 * Conflict detection: two entries conflict iff their windows overlap AND both
 * are not `"cancelled"`. Type-level distinctions (booking vs availability vs
 * maintenance) are NOT interpreted — the kernel only answers "free?".
 */

import type {
  ResourceId,
  CalendarId,
  CalendarEntryId,
  TenantId,
} from "@kernel/shared-kernel";
import type {
  Calendar,
  CalendarEntry,
  TemporalWindow,
} from "@kernel/shared-kernel";
import type { ResourceCalendar } from "../domain";
import { computeCalendarId } from "../domain";

function windowsOverlap(a: TemporalWindow, b: TemporalWindow): boolean {
  return a.start < b.end && a.end > b.start;
}

export class InMemoryResourceCalendar implements ResourceCalendar {
  private readonly calendars = new Map<ResourceId, Calendar>();

  getCalendar(resourceId: ResourceId): Calendar | undefined {
    return this.calendars.get(resourceId);
  }

  ensureCalendar(
    resourceId: ResourceId,
    tenantId: TenantId,
    timezone: string,
    now: number
  ): Calendar {
    const existing = this.calendars.get(resourceId);
    if (existing) return existing;
    const id: CalendarId = computeCalendarId(resourceId, tenantId, now);
    const cal: Calendar = {
      id,
      resourceId,
      tenantId,
      entries: [],
      timezone,
    };
    this.calendars.set(resourceId, cal);
    return cal;
  }

  addEntry(resourceId: ResourceId, entry: CalendarEntry): Calendar {
    const existing = this.calendars.get(resourceId);
    const base: Calendar = existing ?? {
      id: computeCalendarId(resourceId, "" as TenantId, 0),
      resourceId,
      tenantId: "" as TenantId,
      entries: [],
      timezone: "UTC",
    };
    // De-duplicate by entry id (replace if same id).
    const filtered = base.entries.filter((e) => e.id !== entry.id);
    const updated: Calendar = {
      ...base,
      entries: [...filtered, entry].sort((a, b) => a.window.start - b.window.start),
    };
    this.calendars.set(resourceId, updated);
    return updated;
  }

  removeEntry(entryId: CalendarEntryId): Calendar | undefined {
    // Find the calendar that contains this entry.
    for (const [resourceId, cal] of this.calendars.entries()) {
      if (cal.entries.some((e) => e.id === entryId)) {
        const updated: Calendar = {
          ...cal,
          entries: cal.entries.map((e) =>
            e.id === entryId ? { ...e, status: "cancelled" as const } : e
          ),
        };
        this.calendars.set(resourceId, updated);
        return updated;
      }
    }
    return undefined;
  }

  isFree(resourceId: ResourceId, window: TemporalWindow): boolean {
    const cal = this.calendars.get(resourceId);
    if (!cal) return true;
    return !cal.entries.some(
      (e) => e.status !== "cancelled" && windowsOverlap(e.window, window)
    );
  }

  getEntries(
    resourceId: ResourceId,
    window: TemporalWindow
  ): readonly CalendarEntry[] {
    const cal = this.calendars.get(resourceId);
    if (!cal) return [];
    return cal.entries
      .filter((e) => windowsOverlap(e.window, window))
      .slice()
      .sort((a, b) => a.window.start - b.window.start);
  }
}
