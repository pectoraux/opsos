/**
 * @kernel/compiler/stages/graph-builder — phase `finalize`.
 *
 * Builds the final `ExecutionGraph` from the plan's tasks and their
 * dependencies. Each task becomes an `ExecutionNode` referencing a generic
 * `"execute-task@1"` operation (protocol-registered handlers bind the real
 * behavior at runtime). Edges are derived from `task.dependencies`.
 *
 * The graph `seed` is derived deterministically from `intent.id` (via
 * `hashSeed`) so two compilations of the same intent produce the same seed —
 * making execution replayable.
 */

import type {
  Result,
  KernelError,
} from "@kernel/shared-kernel";
import { ok, hashSeed } from "@kernel/shared-kernel";
import type { ExecutionGraph, ExecutionNode, ExecutionEdge } from "@kernel/runtime";
import type { CompilerStage } from "../domain/compiler-stage";
import type { CompilationContext } from "../domain/compilation-context";
import { diagnostic } from "../domain/diagnostic";

export class GraphBuilderStage implements CompilerStage {
  readonly name = "kernel.graph-builder";
  readonly phase = "finalize" as const;
  readonly order = 10;

  run(ctx: CompilationContext): Result<CompilationContext, KernelError> {
    const now = ctx.clock.now();
    const tasks = ctx.state.tasks;

    const nodes: ExecutionNode[] = tasks.map((t) => ({
      id: String(t.id),
      operation: { name: "execute-task", version: 1 },
      inputs: {
        taskId: String(t.id),
        intentId: String(t.intentId),
        capabilityRequirements: t.capabilityRequirements,
        assignee: t.assignee ? String(t.assignee) : undefined,
        scheduleWindow: t.scheduleWindow,
      },
      dependsOn: t.dependencies.map((d) => String(d.taskId)),
    }));

    const edges: ExecutionEdge[] = [];
    for (const node of nodes) {
      for (const dep of node.dependsOn) {
        edges.push({ from: dep, to: node.id });
      }
    }

    const seed = hashSeed(String(ctx.intent.id));

    const graph: ExecutionGraph = {
      id: `graph:${ctx.intent.id}`,
      nodes,
      edges,
      seed,
    };

    const diags = [...ctx.state.diagnostics];
    diags.push(
      diagnostic(
        this.name,
        "info",
        "GRAPH_BUILT",
        `Built execution graph '${graph.id}' with ${nodes.length} node(s), ${edges.length} edge(s), seed=${seed}.`,
        now
      )
    );

    // Promote the plan to "approved" now that a graph exists.
    const plan = ctx.state.plan
      ? { ...ctx.state.plan, status: "approved" as const }
      : undefined;

    return ok(ctx.with({ graph, plan, diagnostics: diags }));
  }
}
