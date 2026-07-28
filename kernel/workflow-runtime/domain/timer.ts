/**
 * @kernel/workflow-runtime/domain/timer — the timer primitive and its registry
 * port.
 *
 * A `Timer` is a deferred signal bound to a specific workflow instance and
 * step. When its `firesAt` is reached, the engine's `tick(now)` fires it,
 * which resumes the bound step. Timers power `timer` steps, step-level
 * timeouts, and retry backoffs.
 *
 * Determinism: `firesAt` is an epoch-ms sourced from the caller's `now`. The
 * registry is a pure data structure (map); `getDue(now)` returns a stable
 * snapshot ordered by `firesAt` then `id`.
 */

/** The lifecycle states of a timer. */
export type TimerStatus = "pending" | "fired" | "cancelled";

/** A deferred signal bound to a workflow step. */
export interface Timer {
  readonly id: string;
  readonly workflowInstanceId: string;
  readonly stepId: string;
  readonly firesAt: number;
  readonly status: TimerStatus;
}

/**
 * The port implemented by `InMemoryTimerRegistry`. Stores timers, lets the
 * engine query due ones, and transition them to `fired` / `cancelled`.
 */
export interface TimerRegistry {
  schedule(timer: Timer): void;
  cancel(timerId: string): void;
  /** All timers with `status==="pending"` and `firesAt <= now`, ordered. */
  getDue(now: number): readonly Timer[];
  /** Mark a timer fired; returns the updated timer or undefined if not found. */
  fire(timerId: string, now: number): Timer | undefined;
  /** Look up a timer by id (read-only). */
  get(timerId: string): Timer | undefined;
  /** All known timers (snapshot, read-only). */
  list(): readonly Timer[];
}
