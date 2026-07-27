/**
 * @kernel/compiler/stages/planner — phase `plan`.
 *
 * Produces `Task`s and a draft `ExecutionPlan` from the resolved demands.
 *
 * Domain-independent planning (M2): one Task per demand, each carrying the
 * demand's capability requirements. Tasks have no inter-dependencies at the
 * kernel level (protocols add dependencies via their own planner stages or
 * via workflow registration). The plan is `status: "draft"`.
 */

import type {
  Result,
  KernelError,
  Task,
  TaskId,
  ExecutionPlan,
  ExecutionPlanId,
  ExecutionGraphRef,
  CapabilityRequirement,
  Quantity,
} from "@kernel/shared-kernel";
import { ok, asId } from "@kernel/shared-kernel";
import type { CompilerStage } from "../domain/compiler-stage";
import type { CompilationContext } from "../domain/compilation-context";
import { diagnostic } from "../domain/diagnostic";

export class PlannerStage implements CompilerStage {
  readonly name = "kernel.planner";
  readonly phase = "plan" as const;
  readonly order = 10;

  run(ctx: CompilationContext): Result<CompilationContext, KernelError> {
    const intent = ctx.state.normalizedIntent ?? ctx.intent;
    const now = ctx.clock.now();

    const tasks: Task[] = ctx.state.demands.map((demand, i) => {
      const capabilityRequirements: CapabilityRequirement[] = [
        {
          capabilityType: demand.resourceType,
          quantity: demand.quantity as Quantity,
          constraints: demand.constraints,
        },
      ];
      return {
        id: asId<"TaskId">(`task:${intent.id}:${i}`),
        intentId: intent.id,
        demandId: demand.id,
        title: `Satisfy demand ${i} of intent ${intent.type}`,
        capabilityRequirements,
        dependencies: [],
        status: "pending",
      };
    });

    const plan: ExecutionPlan = {
      id: asId<"ExecutionPlanId">(`plan:${intent.id}`),
      intentId: intent.id,
      objective: `Compile intent '${intent.type}' into an executable plan`,
      tasks: tasks.map((t) => t.id),
      graph: {
        graphId: `graph:${intent.id}`,
        version: 1,
      } as ExecutionGraphRef,
      constraints: intent.constraints,
      status: "draft",
      version: 1,
    };

    const diags = [...ctx.state.diagnostics];
    diags.push(
      diagnostic(
        this.name,
        "info",
        "PLAN_DRAFTED",
        `Drafted plan '${plan.id}' with ${tasks.length} task(s).`,
        now
      )
    );

    return ok(ctx.with({ tasks, plan, diagnostics: diags }));
  }
}
