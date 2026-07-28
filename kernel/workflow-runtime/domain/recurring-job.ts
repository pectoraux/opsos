/**
 * @kernel/workflow-runtime/domain/recurring-job — recurring job primitive.
 *
 * A `RecurringJob` is a standing instruction to start a new instance of a
 * workflow definition on a schedule (cron or fixed interval). The scheduler
 * computes `nextRun` from the schedule; the engine's `tick(now)` picks up due
 * jobs, starts instances, and calls `markRun` to advance `nextRun`.
 *
 * Determinism: schedules are pure functions of `now`. Cron expansion is a
 * minimal 5-field parser (minute hour day-of-month month day-of-week)
 * supporting star, literal numbers, comma lists, ranges, and step values —
 * no timezone, no `Date` objects. Intervals are plain millisecond offsets.
 */

/** A 5-field cron expression string (e.g. every-5-minutes). */
export type CronExpression = string;

/** A fixed interval in milliseconds. */
export type IntervalMs = number;

/** A recurring schedule: cron or interval. */
export type RecurringSchedule = CronExpression | IntervalMs;

/** The lifecycle states of a recurring job. */
export type RecurringJobStatus = "active" | "paused" | "stopped";

/** A standing instruction to start workflow instances on a schedule. */
export interface RecurringJob {
  readonly id: string;
  readonly workflowDefinitionId: string;
  readonly schedule: RecurringSchedule;
  readonly status: RecurringJobStatus;
  readonly lastRun?: number;
  readonly nextRun?: number;
  /** Input variables seeded into each spawned instance. */
  readonly variables?: Readonly<Record<string, unknown>>;
}

/**
 * The port implemented by `InMemoryRecurringJobScheduler`. Stores jobs,
 * computes `nextRun`, and lets the engine mark a run.
 */
export interface RecurringJobScheduler {
  register(job: RecurringJob): void;
  unregister(jobId: string): void;
  /** All active jobs with `nextRun <= now`, ordered by `nextRun` then `id`. */
  getDue(now: number): readonly RecurringJob[];
  /** Stamp `lastRun = now`, advance `nextRun`, return the updated job. */
  markRun(jobId: string, now: number): RecurringJob | undefined;
  /** Look up a job (read-only). */
  get(jobId: string): RecurringJob | undefined;
  /** All known jobs (snapshot, read-only). */
  list(): readonly RecurringJob[];
}
