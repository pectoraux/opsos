/**
 * @kernel/compiler/stages/optimizer — phase `optimize`.
 *
 * Applies trivial, domain-independent optimization passes to the plan:
 *   - Deduplicate tasks with identical `(intentId, title, capabilityRequirements)`.
 *   - Drop tasks with no capability requirements (no-op tasks).
 *
 * Pure transform on `(plan, tasks)`. Protocols may register additional
 * optimizer stages with domain-specific passes.
 */

import type {
  Result,
  KernelError,
  Task,
  ExecutionPlan,
} from "@kernel/shared-kernel";
import { ok } from "@kernel/shared-kernel";
import type { CompilerStage } from "../domain/compiler-stage";
import type { CompilationContext } from "../domain/compilation-context";
import { diagnostic } from "../domain/diagnostic";

function taskKey(t: Task): string {
  return `${t.intentId}|${t.title}|${JSON.stringify(t.capabilityRequirements)}`;
}

export class OptimizerStage implements CompilerStage {
  readonly name = "kernel.optimizer";
  readonly phase = "optimize" as const;
  readonly order = 10;

  run(ctx: CompilationContext): Result<CompilationContext, KernelError> {
    if (!ctx.state.plan || ctx.state.tasks.length === 0) {
      return ok(ctx); // nothing to optimize
    }

    const now = ctx.clock.now();
    const before = ctx.state.tasks.length;

    // Drop no-op tasks (no capability requirements).
    let tasks = ctx.state.tasks.filter(
      (t) => t.capabilityRequirements.length > 0
    );

    // Deduplicate by structural key, preserving first occurrence (deterministic).
    const seen = new Set<string>();
    tasks = tasks.filter((t) => {
      const k = taskKey(t);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    const removed = before - tasks.length;
    const diags = [...ctx.state.diagnostics];
    if (removed > 0) {
      diags.push(
        diagnostic(
          this.name,
          "info",
          "PLAN_OPTIMIZED",
          `Optimizer removed ${removed} task(s) (${before} → ${tasks.length}).`,
          now
        )
      );
    }

    const optimizedPlan: ExecutionPlan = {
      ...ctx.state.plan,
      tasks: tasks.map((t) => t.id),
      status: "proposed",
      version: ctx.state.plan.version + 1,
    };

    return ok(ctx.with({ tasks, plan: optimizedPlan, diagnostics: diags }));
  }
}
