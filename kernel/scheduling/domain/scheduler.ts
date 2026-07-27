/**
 * @kernel/scheduling/domain/scheduler — the Scheduler PORT.
 *
 * Per ADR-0008, Milestone 1 ships the `Scheduler` PORT ONLY — NO
 * dispatch / routing algorithm in the kernel. Concrete schedulers are
 * protocol-specific and installed later via the extension system. The kernel
 * provides a `NoopScheduler` placeholder (in `infrastructure/`) so the kernel
 * compiles and runs end-to-end.
 *
 * The port takes a `ScheduleRequest` (tenant, demands, resources, policy,
 * bounding window, correlationId) plus a `now` epoch-millis (sourced by the
 * caller from `ExecutionContext.clock.now()`) and returns a `ScheduleResult`
 * — a realised `Schedule`, the planned `Route[]`, the list of unmet `DemandId`s,
 * and a bag of warnings. The result is a pure projection of
 * `(request, now)` for any given `Scheduler` implementation.
 *
 * `now` is passed explicitly (rather than reading `ExecutionContext` directly)
 * so the domain layer keeps its only allowed dependency on `@kernel/shared-kernel`
 * — the runtime's clock is consulted by the *caller*, preserving the layered
 * dependency rule. (The docs list `@kernel/runtime` as an allowed dependency;
 * this module deliberately doesn't need it.)
 */

import type {
  TenantId,
  Demand,
  Resource,
  Route,
  DemandId,
} from "@kernel/shared-kernel";
import type { Schedule, ScheduleWindow } from "./schedule";
import type { SchedulePolicy } from "./schedule-policy";

// Re-export the canonical operational primitives the scheduler consumes, so
// consumers of `@kernel/scheduling` have a single import surface. These are
// type-only re-exports (erased at runtime).
export type { Demand, Resource, Route } from "@kernel/shared-kernel";

/**
 * A request to plan a schedule. Pure data — no behaviour, no I/O.
 *
 * `correlationId` threads the originating logical operation end-to-end (it
 * matches the `ExecutionContext.correlationId` of the caller).
 */
export interface ScheduleRequest {
  readonly tenantId: TenantId;
  readonly demands: readonly Demand[];
  readonly resources: readonly Resource[];
  readonly policy: SchedulePolicy;
  readonly window: ScheduleWindow;
  readonly correlationId: string;
}

/**
 * The result of planning a schedule.
 *
 * `schedule` is the realised `Schedule` (slots + status); `routes` are the
 * resource-task assignments; `unmet` lists demand ids the scheduler could not
 * satisfy; `warnings` is a bag of non-fatal notices. `producedAt` is the
 * clock-sourced timestamp (`now` passed to `plan()`); `plannerId` identifies
 * which `Scheduler` implementation produced this result.
 */
export interface ScheduleResult {
  readonly schedule: Schedule;
  readonly routes: readonly Route[];
  readonly unmet: readonly DemandId[];
  readonly warnings: readonly string[];
  /** Clock-sourced epoch-millis (from the `now` argument to `plan`). */
  readonly producedAt: number;
  /** Id of the `Scheduler` that produced this result (e.g. `"noop"`). */
  readonly plannerId: string;
}

/**
 * The Scheduler PORT. A `Scheduler` materialises a `ScheduleRequest` into a
 * `ScheduleResult`. Implementations MAY be sync or async; the application
 * layer always `await`s the result.
 *
 * Implementations MUST be deterministic with respect to `(request, now)`:
 * identical inputs produce identical outputs. `now` is the ONLY sanctioned
 * source of time inside `plan()` — `Date.now()` is forbidden (determinism rule).
 */
export interface Scheduler {
  /** Identifier of this scheduler implementation (e.g. `"noop"`). */
  readonly id: string;
  /**
   * Plan `request` into a schedule + routes.
   *
   * @param request the scheduling request (tenant, demands, resources, policy, window)
   * @param now     epoch-millis, sourced by the caller from `ExecutionContext.clock.now()`
   */
  plan(request: ScheduleRequest, now: number): Promise<ScheduleResult> | ScheduleResult;
}
