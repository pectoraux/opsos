/**
 * @kernel/shared-kernel — temporal value objects.
 *
 * `TemporalWindow` is the universal time-window value object used across
 * demands, tasks, schedules, availability. `ScheduleWindow` and
 * `RecurrenceRule` are the canonical scheduling-shape types (realized by the
 * `scheduling` module). All times are epoch-millis from `RuntimeClock`.
 */

export interface TemporalWindow {
  readonly start: number;
  readonly end: number;
  readonly timezone: string;
}

/** A schedule's outer bounding window. */
export interface ScheduleWindow {
  readonly start: number;
  readonly end: number;
  readonly timezone: string;
}

/**
 * Generic recurrence rule (RRULE-shaped). The kernel defines the *shape* only;
 * expansion is performed by the scheduling module / protocols.
 */
export interface RecurrenceRule {
  readonly freq: "second" | "minute" | "hour" | "day" | "week" | "month" | "year";
  readonly interval: number;
  readonly count?: number;
  readonly until?: number;
  readonly byDays?: readonly string[];
}
