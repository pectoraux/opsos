/**
 * @kernel/resource-kernel/domain/resource-calendar — the ResourceCalendar PORT.
 *
 * Owns each resource's calendar — bookings, blocks, availability windows,
 * maintenance windows, travel entries. The Coordination Kernel asks "is this
 * resource free for window W?" via this engine; it never inspects entries
 * directly.
 *
 * Conflict detection is purely temporal: two entries conflict iff their
 * windows overlap AND both are not `cancelled`. Type-level distinctions
 * (booking vs availability vs maintenance) are the protocol's concern; the
 * kernel only answers the binary "free?" question.
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`.
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

/**
 * The ResourceCalendar PORT.
 */
export interface ResourceCalendar {
  /**
   * Returns the resource's calendar (or `undefined` if none registered).
   */
  getCalendar(resourceId: ResourceId): Calendar | undefined;
  /**
   * Initialises / replaces the resource's calendar. A new `CalendarId` is
   * derived deterministically from `resourceId` + `tenantId` + `now`.
   */
  ensureCalendar(
    resourceId: ResourceId,
    tenantId: TenantId,
    timezone: string,
    now: number
  ): Calendar;
  /**
   * Adds an entry to the resource's calendar. Returns the updated calendar.
   * If no calendar exists, one is created first (timezone defaults to "UTC").
   */
  addEntry(resourceId: ResourceId, entry: CalendarEntry): Calendar;
  /**
   * Removes (cancels) an entry by id. Idempotent — returns the calendar
   * unchanged if the entry is not found.
   */
  removeEntry(entryId: CalendarEntryId): Calendar | undefined;
  /**
   * Returns `true` iff the resource has NO non-cancelled entry overlapping
   * `window`. Resources with no calendar are considered free.
   */
  isFree(resourceId: ResourceId, window: TemporalWindow): boolean;
  /**
   * Returns all entries for the resource whose windows overlap `window`
   * (ordered by start time). Returns `[]` if no calendar exists.
   */
  getEntries(
    resourceId: ResourceId,
    window: TemporalWindow
  ): readonly CalendarEntry[];
}

/**
 * Construct a deterministic `CalendarId` from a resource id + tenant + clock
 * tick. Exposed so protocol layers can reproduce ids in tests / replay.
 *
 * Format: `cal#${resourceId}#${tenantId}#${now}`.
 */
export function computeCalendarId(
  resourceId: ResourceId,
  tenantId: TenantId,
  now: number
): CalendarId {
  return `cal#${resourceId}#${tenantId}#${now}` as unknown as CalendarId;
}
