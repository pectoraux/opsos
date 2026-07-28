/**
 * @kernel/scheduling/infrastructure/noop-scheduler — the `NoopScheduler`
 * placeholder implementation of the `Scheduler` PORT.
 *
 * Placeholder per ADR-0008. Real schedulers are protocol-supplied and
 * installed later via the extension system. The kernel ships NO
 * dispatch / routing algorithm in Milestone 1 — this adapter exists solely so
 * the kernel compiles and runs end-to-end (e.g. for self-test / smoke flows).
 *
 * `plan()` returns an EMPTY schedule (no slots, no routes), with every demand
 * listed in `unmet`, a single warning `"noop-scheduler: no algorithm installed"`,
 * and `producedAt = now`. Deterministic in `(request, now)`.
 */

import { asId } from "@kernel/shared-kernel";
import type {
  Scheduler,
  ScheduleRequest,
  ScheduleResult,
} from "../domain/scheduler";

/**
 * Placeholder `Scheduler`. Returns an empty plan with all demands unmet.
 *
 * Per ADR-0008 — DO NOT add algorithm logic here. Protocol-supplied
 * schedulers replace this adapter at extension-install time.
 */
export class NoopScheduler implements Scheduler {
  readonly id = "noop";

  plan(request: ScheduleRequest, now: number): ScheduleResult {
    return {
      schedule: {
        // Deterministic schedule id derived from (correlationId, now) — the
        // same request at the same clock tick always yields the same id.
        // `now` is sourced by the caller from `ExecutionContext.clock.now()`.
        id: asId<"ScheduleId">(`noop#${request.correlationId}#${now}`),
        window: request.window,
        slots: [],
        status: "draft",
      },
      routes: [],
      unmet: request.demands.map((d) => d.id),
      warnings: ["noop-scheduler: no algorithm installed"],
      producedAt: now,
      plannerId: this.id,
    };
  }
}
