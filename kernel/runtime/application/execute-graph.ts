/**
 * @kernel/runtime/application/execute-graph — the use-case that orchestrates
 * graph execution.
 *
 * Thin orchestration layer above `RuntimeExecutor`: it opens an observability
 * span around the execution, records outcome attributes, and delegates the
 * actual work to the injected executor. Keeping this as a separate use-case
 * preserves the CQRS command-handler shape and gives Wave-2 modules a single
 * sanctioned entry point for "run a graph".
 */

import type { ExecutionGraph } from "../domain/execution-graph";
import type { RuntimeState } from "../domain/runtime-state";
import type { ExecutionResult } from "../domain/execution-result";
import type { RuntimeExecutor } from "../domain/runtime-executor";
import type { ExecutionContext } from "../domain/execution-context";

export interface ExecuteGraphUseCaseDeps {
  readonly executor: RuntimeExecutor;
}

export class ExecuteGraphUseCase {
  constructor(private readonly deps: ExecuteGraphUseCaseDeps) {}

  async execute(
    graph: ExecutionGraph,
    inputState: RuntimeState,
    ctx: ExecutionContext
  ): Promise<ExecutionResult> {
    const span = ctx.observability.tracer.startSpan(
      "runtime.executeGraph",
      undefined,
      {
        "graph.id": graph.id,
        "graph.seed": graph.seed,
        "graph.nodeCount": graph.nodes.length,
        "graph.edgeCount": graph.edges.length,
        "correlationId": ctx.correlationId,
        "traceId": ctx.traceId,
      }
    );
    try {
      const result = await this.deps.executor.execute(graph, inputState, ctx);
      span.setAttribute("result.ok", result.ok);
      span.setAttribute("result.stepCount", result.steps.length);
      span.setAttribute("result.eventCount", result.eventsEmitted.length);
      span.setAttribute("result.durationMs", result.endedAt - result.startedAt);
      if (!result.ok) {
        span.setAttribute("result.failedNodes", result.steps.length);
      }
      return result;
    } catch (e) {
      span.recordError(e);
      throw e;
    } finally {
      span.end(ctx.clock.now());
    }
  }
}

/**
 * Convenience factory: build a `RuntimeExecutor.execute` bound function with
 * observability instrumentation, suitable for one-off use without instantiating
 * the use-case class explicitly.
 */
export function createExecuteGraph(deps: ExecuteGraphUseCaseDeps): ExecuteGraphUseCase {
  return new ExecuteGraphUseCase(deps);
}
