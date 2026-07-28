/**
 * @kernel/scheduling/domain — barrel.
 *
 * Pure domain layer of the scheduling bounded context. Depends ONLY on
 * `@kernel/shared-kernel` (the canonical `Schedule`, `ScheduleSlot`,
 * `ScheduleWindow`, `RecurrenceRule`, `Route`, `Demand`, `Resource`, branded
 * IDs, `Result`/`Option`, value objects, errors). No I/O, no `Date.now()`, no
 * `Math.random()` — every timestamp flows in as an epoch-millis argument
 * (sourced by the caller from `ExecutionContext.clock.now()`).
 *
 * Public surface (re-exported through `@kernel/scheduling`):
 *   - Schedule types:    `Schedule`, `ScheduleSlot`, `ScheduleWindow`,
 *                         `RecurrenceRule`, `ScheduleStatus` (canonical re-exports)
 *   - Schedule helpers:  `createScheduleWindow`, `createScheduleSlot`,
 *                         `slotsOverlap`, `isWithin`
 *   - Recurrence:        `expandRecurrence`, `MAX_EXPANSION`
 *   - Route:             `Route`, `RouteStatus` (canonical re-exports), `RoutePlan`
 *   - Policy:            `SchedulePolicy`, `validateSchedule`
 *   - Scheduler PORT:    `Scheduler`, `ScheduleRequest`, `ScheduleResult`
 */
export * from "./schedule";
export * from "./recurrence";
export * from "./route";
export * from "./schedule-policy";
export * from "./scheduler";
