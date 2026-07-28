/**
 * @kernel/integration-hub/domain/sync-job — the SyncJob primitive and the
 * SyncScheduler port.
 *
 * A `SyncJob` describes a periodic data-sync between OpsOS and an external
 * system, scoped to a connector + capability, with a direction (import |
 * export | bidirectional) and a schedule (a cron expression OR a fixed
 * interval in milliseconds). Active jobs are picked up by the scheduler's
 * `getDue(now)`, executed by the `RunSync` use-case, and stamped with
 * `markSynced(jobId, result, now)`.
 *
 * The `SyncScheduler` PORT mirrors the recurring-job scheduler pattern: it
 * stores jobs, returns due ones ordered by `nextRun`, and marks them
 * synced. Cron expansion uses a pure function of the epoch-ms argument.
 *
 * Determinism: no `Date.now()` / `Math.random()`; every timestamp flows
 * from the caller's `now`.
 */

/** The direction of a sync job. */
export type SyncDirection = "import" | "export" | "bidirectional";

/** Lifecycle state of a sync job. */
export type SyncJobStatus = "active" | "paused" | "stopped";

/** A cron expression string (5 fields: minute hour dom month dow). */
export type CronExpression = string;

/** An interval in milliseconds. */
export type IntervalMs = number;

/** A sync schedule — either a cron expression or a fixed interval. */
export type SyncSchedule = CronExpression | IntervalMs;

/** The outcome of a single sync run. */
export interface SyncResult {
  readonly jobId: string;
  readonly status: "success" | "failed";
  readonly recordsProcessed: number;
  readonly error?: string;
  /** Epoch-ms timestamp sourced from the caller's `now`. */
  readonly finishedAt: number;
  /** Latency in milliseconds, derived from caller-supplied time. */
  readonly latencyMs: number;
}

/** A periodic data-sync between OpsOS and an external system. */
export interface SyncJob {
  readonly id: string;
  readonly connectorId: string;
  readonly capabilityId: string;
  readonly direction: SyncDirection;
  readonly schedule: SyncSchedule;
  readonly status: SyncJobStatus;
  /** Epoch-ms of the last successful sync, if any. */
  readonly lastSync?: number;
  /** Outcome of the last sync, if any. */
  readonly lastResult?: SyncResult;
  /**
   * Epoch-ms of the next scheduled run. Computed by the scheduler on
   * register / markSynced; undefined if the job is paused or stopped.
   */
  readonly nextRun?: number;
}

/**
 * The port implemented by `InMemorySyncScheduler`. Stores jobs, returns due
 * active jobs ordered by `nextRun` then `id`, and stamps them with the
 * latest sync result + recomputed `nextRun`.
 */
export interface SyncScheduler {
  register(job: SyncJob): void;
  unregister(jobId: string): void;
  /** Look up a job by id. */
  get(jobId: string): SyncJob | undefined;
  /** All active jobs with `nextRun <= now`, ordered by `nextRun` then `id`. */
  getDue(now: number): readonly SyncJob[];
  /** Stamp a job with its latest result and compute the next run. */
  markSynced(jobId: string, result: SyncResult, now: number): SyncJob | undefined;
  /** All known jobs (snapshot, read-only). */
  list(): readonly SyncJob[];
}
