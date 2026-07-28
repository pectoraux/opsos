/**
 * @kernel/integration-hub/infrastructure/in-memory-sync-scheduler — the
 * reference `SyncScheduler` implementation.
 *
 * Stores jobs in a `Map<string, SyncJob>`. On `register`, computes `nextRun`
 * (if the job is `active`) from the schedule. On `markSynced`, stamps the
 * job with the latest result, recomputes `nextRun`, and returns the updated
 * job. `getDue(now)` returns active jobs with `nextRun <= now`, ordered by
 * `nextRun` then `id`.
 *
 * For interval schedules, `nextRun = lastSync + interval` (or
 * `register-now + interval` on first run — `register-now` is the `now` the
 * caller passed at register time, recovered from the absence of `lastSync`).
 * For cron schedules, `nextRun` is computed by a minimal 5-field cron
 * parser (the same algorithm as the workflow-runtime scheduler, lifted here
 * so this module stays self-contained).
 *
 * Determinism: cron expansion uses `new Date(ms).getUTC*()` — a PURE function
 * of the epoch-ms argument (no wall clock). No `Date.now()`, no `Math.random()`.
 */

import type {
  CronExpression,
  IntervalMs,
  SyncJob,
  SyncResult,
  SyncScheduler,
  SyncSchedule,
} from "../domain";

export class InMemorySyncScheduler implements SyncScheduler {
  private readonly jobs = new Map<string, SyncJob>();

  register(job: SyncJob): void {
    if (job.status === "active") {
      const nextRun =
        job.nextRun ?? computeNextRun(job.schedule, job.lastSync ?? 0);
      this.jobs.set(job.id, { ...job, nextRun });
    } else {
      this.jobs.set(job.id, { ...job, nextRun: undefined });
    }
  }

  unregister(jobId: string): void {
    this.jobs.delete(jobId);
  }

  get(jobId: string): SyncJob | undefined {
    return this.jobs.get(jobId);
  }

  getDue(now: number): readonly SyncJob[] {
    const due: SyncJob[] = [];
    for (const j of this.jobs.values()) {
      if (j.status === "active" && j.nextRun !== undefined && j.nextRun <= now) {
        due.push(j);
      }
    }
    due.sort((a, b) =>
      (a.nextRun ?? 0) !== (b.nextRun ?? 0)
        ? (a.nextRun ?? 0) - (b.nextRun ?? 0)
        : a.id < b.id
          ? -1
          : a.id > b.id
            ? 1
            : 0
    );
    return due;
  }

  markSynced(jobId: string, result: SyncResult, now: number): SyncJob | undefined {
    const j = this.jobs.get(jobId);
    if (!j) return undefined;
    const nextRun = computeNextRun(j.schedule, now);
    const updated: SyncJob = {
      ...j,
      lastSync: now,
      lastResult: result,
      nextRun: j.status === "active" ? nextRun : undefined,
    };
    this.jobs.set(jobId, updated);
    return updated;
  }

  list(): readonly SyncJob[] {
    return Array.from(this.jobs.values());
  }
}

// ── Schedule expansion ─────────────────────────────────────────────────────

/** Compute the next run time strictly after `after` for the given schedule. */
function computeNextRun(schedule: SyncSchedule, after: number): number {
  if (typeof schedule === "number") {
    const base = after > 0 ? after : 0;
    return base + (schedule as IntervalMs);
  }
  return nextCronTime(schedule as CronExpression, after);
}

// ── Cron parser (5-field, UTC, traditional dom/dow OR semantics) ───────────

interface CronField {
  readonly values: ReadonlySet<number> | "*";
}

interface CronParts {
  readonly minute: CronField;
  readonly hour: CronField;
  readonly dom: CronField;
  readonly month: CronField;
  readonly dow: CronField;
}

function parseCron(cron: string): CronParts {
  const fields = cron.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(
      `Invalid cron expression '${cron}': expected 5 fields, got ${fields.length}`
    );
  }
  const [minute, hour, dom, month, dow] = fields;
  return {
    minute: parseField(minute, 0, 59),
    hour: parseField(hour, 0, 23),
    dom: parseField(dom, 1, 31),
    month: parseField(month, 1, 12),
    dow: parseField(dow, 0, 6),
  };
}

function parseField(field: string, min: number, max: number): CronField {
  if (field === "*") return { values: "*" };

  const values = new Set<number>();
  for (const part of field.split(",")) {
    const stepMatch = part.match(/^\*\/(\d+)$/);
    if (stepMatch) {
      const step = parseInt(stepMatch[1], 10);
      for (let v = min; v <= max; v += step) values.add(v);
      continue;
    }
    const rangeMatch = part.match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
    if (rangeMatch) {
      const lo = parseInt(rangeMatch[1], 10);
      const hi = parseInt(rangeMatch[2], 10);
      const step = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : 1;
      for (let v = lo; v <= hi; v += step) values.add(v);
      continue;
    }
    const numMatch = part.match(/^(\d+)$/);
    if (numMatch) {
      values.add(parseInt(numMatch[1], 10));
      continue;
    }
    throw new Error(`Invalid cron field '${field}'`);
  }
  return { values };
}

function fieldMatches(field: CronField, value: number): boolean {
  return field.values === "*" || field.values.has(value);
}

function matchCron(parts: CronParts, ms: number): boolean {
  const d = new Date(ms);
  const minute = d.getUTCMinutes();
  const hour = d.getUTCHours();
  const dom = d.getUTCDate();
  const month = d.getUTCMonth() + 1;
  const dow = d.getUTCDay();

  if (!fieldMatches(parts.month, month)) return false;
  if (!fieldMatches(parts.minute, minute)) return false;
  if (!fieldMatches(parts.hour, hour)) return false;

  // Traditional cron: if both dom and dow are restricted, fire if EITHER matches.
  const domRestricted = parts.dom.values !== "*";
  const dowRestricted = parts.dow.values !== "*";
  if (domRestricted && dowRestricted) {
    return fieldMatches(parts.dom, dom) || fieldMatches(parts.dow, dow);
  }
  return fieldMatches(parts.dom, dom) && fieldMatches(parts.dow, dow);
}

/**
 * Find the next minute (strictly after `after`) matching the cron expression.
 * Searches minute-by-minute, capped at one year to avoid infinite loops.
 */
function nextCronTime(cron: string, after: number): number {
  const parts = parseCron(cron);
  const start = Math.floor(after / 60_000) * 60_000 + 60_000;
  const cap = start + 366 * 24 * 60 * 60_000;
  for (let t = start; t <= cap; t += 60_000) {
    if (matchCron(parts, t)) return t;
  }
  return cap;
}
