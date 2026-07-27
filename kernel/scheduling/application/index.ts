/**
 * @kernel/scheduling/application — barrel.
 *
 * The application layer of the scheduling bounded context. Contains the thin
 * `planSchedule` use-case that delegates to the `Scheduler` PORT. No I/O, no
 * `Date.now()` — `now` is sourced by the caller from
 * `ExecutionContext.clock.now()` and passed as an argument.
 */
export * from "./plan-schedule";
