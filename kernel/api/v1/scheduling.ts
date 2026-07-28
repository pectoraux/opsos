/**
 * @kernel/api/v1 — SCHEDULING public surface (FROZEN).
 *
 * Temporal-allocation FOUNDATION. Per ADR-0008 the kernel ships the Scheduler
 * PORT + types ONLY — no dispatch/routing algorithm. Concrete schedulers are
 * protocol-supplied.
 */
export type {
  Schedule,
  ScheduleSlot,
  ScheduleWindow,
  RecurrenceRule,
  ScheduleStatus,
  Route,
  RouteStatus,
  SchedulePolicy,
  Scheduler,
  ScheduleRequest,
  ScheduleResult,
} from "@kernel/scheduling";

export {
  createScheduleWindow,
  createScheduleSlot,
  slotsOverlap,
  isWithin,
  expandRecurrence,
  validateSchedule,
  planSchedule,
  NoopScheduler,
} from "@kernel/scheduling";
