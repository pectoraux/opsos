/**
 * @kernel/compiler/stages/scheduler-stage — phase `schedule`.
 *
 * Delegates to the injected `Scheduler` port to materialise a `Schedule` +
 * `Route[]` for the plan's demands. Per ADR-0008 the kernel ships no
 * scheduling algorithm; with `NoopScheduler` the schedule is empty and all
 * demands are `unmet` (the stage records this as a `warn` diagnostic, not an
 * error — the graph is still built; execution will simply have no temporal
 * assignments).
 *
 * `now` is sourced from `ctx.clock.now()`.
 */

import type {
  Result,
  KernelError,
  TenantId,
  Resource,
  Constraint,
} from "@kernel/shared-kernel";
import { ok, asId } from "@kernel/shared-kernel";
import type { Scheduler, ScheduleRequest } from "@kernel/scheduling";
import type { SchedulePolicy } from "@kernel/scheduling";
import type { CompilerStage } from "../domain/compiler-stage";
import type { CompilationContext } from "../domain/compilation-context";
import { diagnostic } from "../domain/diagnostic";

export interface SchedulerStageDeps {
  readonly scheduler: Scheduler;
  /** Default schedule policy when the intent carries none. */
  readonly defaultPolicy?: SchedulePolicy;
}

const DEFAULT_POLICY: SchedulePolicy = {
  id: "compiler.default-schedule-policy",
  name: "Compiler default",
  maxSlotsPerResource: 1,
  minSlotDurationMs: 60_000,
  maxSlotDurationMs: 86_400_000,
  requiredGapMs: 0,
  allowedWindows: [],
  excludedWindows: [],
  constraints: [] as readonly Constraint[],
};

export class SchedulerStage implements CompilerStage {
  readonly name = "kernel.scheduler";
  readonly phase = "schedule" as const;
  readonly order = 10;
  private readonly scheduler: Scheduler;
  private readonly defaultPolicy: SchedulePolicy;

  constructor(deps: SchedulerStageDeps) {
    this.scheduler = deps.scheduler;
    this.defaultPolicy = deps.defaultPolicy ?? DEFAULT_POLICY;
  }

  async run(ctx: CompilationContext): Promise<Result<CompilationContext, KernelError>> {
    if (ctx.state.demands.length === 0) {
      return ok(ctx);
    }
    const now = ctx.clock.now();

    // Derive a bounding window from the first demand's temporal window.
    const firstWindow = ctx.state.demands[0]!.temporalWindow;
    const request: ScheduleRequest = {
      tenantId: (ctx.tenantId ?? asId<"TenantId">("default")) as TenantId,
      demands: ctx.state.demands,
      resources: [] as readonly Resource[], // protocols supply resources via their own stages
      policy: this.defaultPolicy,
      window: {
        start: firstWindow.start,
        end: firstWindow.end,
        timezone: firstWindow.timezone,
      },
      correlationId: ctx.correlationId,
    };

    const result = await this.scheduler.plan(request, now);
    const diags = [...ctx.state.diagnostics];

    if (result.unmet.length > 0) {
      diags.push(
        diagnostic(
          this.name,
          "warn",
          "SCHEDULE_UNMET",
          `Scheduler '${this.scheduler.id}' left ${result.unmet.length}/${ctx.state.demands.length} demand(s) unmet. ${result.warnings.join("; ")}`.trim(),
          now
        )
      );
    } else {
      diags.push(
        diagnostic(
          this.name,
          "info",
          "SCHEDULE_PRODUCED",
          `Scheduler '${this.scheduler.id}' produced ${result.schedule.slots.length} slot(s).`,
          now
        )
      );
    }

    return ok(
      ctx.with({
        schedule: result.schedule,
        routes: result.routes,
        diagnostics: diags,
      })
    );
  }
}
