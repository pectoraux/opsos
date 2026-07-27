/**
 * @kernel/scheduling/infrastructure — barrel.
 *
 * Port implementations for the scheduling bounded context. Per ADR-0008 the
 * only scheduler implementation shipped in Milestone 1 is `NoopScheduler`
 * (placeholder). Concrete algorithms are protocol-supplied via the extension
 * system.
 *
 * `infrastructure/` is intentionally part of the public barrel for scheduling
 * (mirroring the `runtime` / `events` / `projections` modules) because the
 * `NoopScheduler` is the default scheduler consumers wire up out of the box.
 */
export * from "./noop-scheduler";
