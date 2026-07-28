/**
 * @kernel/scheduling/application/plan-schedule — the use-case that delegates to
 * the `Scheduler` PORT.
 *
 * Thin orchestration layer above `Scheduler`: it delegates the actual planning
 * work to the injected scheduler (which may be the `NoopScheduler` placeholder
 * or a protocol-supplied real scheduler installed via the extension system).
 *
 * `now` is sourced by the CALLER from `ExecutionContext.clock.now()` and passed
 * in explicitly — the application layer therefore has NO direct dependency on
 * `@kernel/runtime` (the docs list it as an allowed dep; this module simply
 * doesn't need it). This preserves the inward-only dependency rule.
 *
 * Per ADR-0008 there is NO dispatch/routing algorithm in the kernel; this
 * use-case is a pure delegation, not a planner.
 */

import type {
  Scheduler,
  ScheduleRequest,
  ScheduleResult,
} from "../domain/scheduler";

/**
 * Plan a schedule by delegating to the supplied `Scheduler`.
 *
 * @param scheduler the `Scheduler` port implementation to delegate to
 * @param request   the scheduling request
 * @param now       epoch-millis, sourced by the caller from
 *                  `ExecutionContext.clock.now()`
 * @returns the `ScheduleResult` produced by `scheduler.plan(request, now)`
 */
export async function planSchedule(
  scheduler: Scheduler,
  request: ScheduleRequest,
  now: number
): Promise<ScheduleResult> {
  return Promise.resolve(scheduler.plan(request, now));
}
