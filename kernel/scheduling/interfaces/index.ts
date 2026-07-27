/**
 * @kernel/scheduling — public surface.
 *
 * The temporal-allocation FOUNDATION. Per ADR-0008, Milestone 1 ships the
 * scheduling TYPES and a `Scheduler` PORT ONLY — NO dispatch / routing
 * algorithm. Concrete schedulers are protocol-specific and installed later via
 * the extension system. A `NoopScheduler` placeholder ships so the kernel
 * compiles and runs end-to-end.
 *
 * Dependency direction: `interfaces/ → application/ → domain/` and
 * `infrastructure/ → application/ → domain/`. `domain/` depends ONLY on
 * `@kernel/shared-kernel` (canonical primitives, branded IDs, `Result`/`Option`,
 * value objects, errors). The docs list `@kernel/events` and `@kernel/runtime`
 * as allowed dependencies; this module deliberately does NOT need them at the
 * type level — `now` is sourced by the caller from `ExecutionContext.clock.now()`
 * and passed as an argument, so the domain layer stays decoupled.
 *
 * Public surface:
 *   - Schedule types:   `Schedule`, `ScheduleSlot`, `ScheduleWindow`,
 *                        `RecurrenceRule`, `ScheduleStatus`
 *   - Schedule helpers: `createScheduleWindow`, `createScheduleSlot`,
 *                        `slotsOverlap`, `isWithin`
 *   - Recurrence:       `expandRecurrence`, `MAX_EXPANSION`
 *   - Route:            `Route`, `RouteStatus`, `RoutePlan`
 *   - Policy:           `SchedulePolicy`, `validateSchedule`
 *   - Scheduler PORT:   `Scheduler`, `ScheduleRequest`, `ScheduleResult`
 *   - Application:      `planSchedule` (delegating use-case)
 *   - Adapter:          `NoopScheduler` (placeholder per ADR-0008)
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
