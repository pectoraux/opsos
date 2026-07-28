/**
 * @kernel/compiler/stages/router — phase `route`.
 *
 * Maps each planned `Task` to a `Resource` over a `ScheduleSlot` (a `Route`).
 * Domain-independent routing (M2): if the scheduler produced slots with
 * assigned resources, route each task to the first available slot in sequence;
 * otherwise (e.g. under `NoopScheduler`), routes is empty and a `warn`
 * diagnostic is recorded.
 *
 * Protocols register domain-specific routers (e.g. geo-aware, skill-aware) as
 * additional `route`-phase stages.
 */

import type {
  Result,
  KernelError,
  Route,
  RouteId,
  Constraint,
} from "@kernel/shared-kernel";
import { ok, asId } from "@kernel/shared-kernel";
import type { CompilerStage } from "../domain/compiler-stage";
import type { CompilationContext } from "../domain/compilation-context";
import { diagnostic } from "../domain/diagnostic";

export class RouterStage implements CompilerStage {
  readonly name = "kernel.router";
  readonly phase = "route" as const;
  readonly order = 10;

  run(ctx: CompilationContext): Result<CompilationContext, KernelError> {
    const now = ctx.clock.now();
    const schedule = ctx.state.schedule;

    if (!schedule || schedule.slots.length === 0) {
      const diags = [...ctx.state.diagnostics];
      diags.push(
        diagnostic(
          this.name,
          "warn",
          "ROUTES_EMPTY",
          "No schedule slots available; tasks are unassigned. A protocol router stage is required for resource assignment.",
          now
        )
      );
      return ok(ctx.with({ routes: [], diagnostics: diags }));
    }

    // Assign tasks to slots in deterministic order (task id asc, slot order).
    const sortedTasks = [...ctx.state.tasks].sort((a, b) =>
      String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0
    );
    const slots = schedule.slots;
    const routes: Route[] = [];
    for (let i = 0; i < sortedTasks.length && i < slots.length; i++) {
      const task = sortedTasks[i]!;
      const slot = slots[i]!;
      if (!slot.resourceId) continue;
      routes.push({
        id: asId<"RouteId">(`route:${task.id}:${slot.id}`),
        taskId: task.id,
        resourceId: slot.resourceId,
        scheduleSlotId: slot.id,
        sequence: i,
        constraints: [] as readonly Constraint[],
        status: "planned",
      });
    }

    const diags = [...ctx.state.diagnostics];
    diags.push(
      diagnostic(
        this.name,
        "info",
        "ROUTES_PRODUCED",
        `Routed ${routes.length}/${sortedTasks.length} task(s).`,
        now
      )
    );

    return ok(ctx.with({ routes, diagnostics: diags }));
  }
}
