/**
 * @kernel/scheduling/domain/route — routing domain types.
 *
 * Re-exports the canonical `Route` and `RouteStatus` primitives from
 * `@kernel/shared-kernel` (defined in `domain/primitives/schedule.ts` there)
 * and adds `RoutePlan` — a value object grouping the routes a `Scheduler`
 * produced against a single `Schedule`. The kernel ships NO routing algorithm
 * in Milestone 1 (ADR-0008); `RoutePlan` is the *shape* a real planner returns.
 */

import type {
  Route,
  RouteStatus,
  ScheduleId,
} from "@kernel/shared-kernel";

// ── Canonical re-exports ───────────────────────────────────────────────────
export type { Route, RouteStatus } from "@kernel/shared-kernel";

/**
 * The plan of routes produced by a `Scheduler` against a single `Schedule`.
 * Pure data — no behaviour. `producedAt` is sourced from the caller's clock
 * (`ExecutionContext.clock.now()`); `plannerId` identifies which `Scheduler`
 * implementation produced the plan (e.g. `"noop"` or a protocol-supplied id).
 */
export interface RoutePlan {
  readonly scheduleId: ScheduleId;
  readonly routes: readonly Route[];
  readonly producedAt: number;
  readonly plannerId: string;
}
