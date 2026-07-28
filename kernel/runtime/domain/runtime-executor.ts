/**
 * @kernel/runtime/domain/runtime-executor — the executor PORT.
 *
 * A `RuntimeExecutor` runs an `ExecutionGraph` against an input `RuntimeState`
 * inside an `ExecutionContext`, producing a deterministic `ExecutionResult`.
 *
 * The concrete reference implementation (`DeterministicRuntimeExecutor`) lives
 * in `infrastructure/`. Other executors (e.g. a parallelising executor that
 * still respects the deterministic topological order) may be plugged in later.
 */

import type { ExecutionGraph } from "./execution-graph";
import type { RuntimeState } from "./runtime-state";
import type { ExecutionResult } from "./execution-result";
import type { ExecutionContext } from "./execution-context";

export interface RuntimeExecutor {
  /**
   * Execute `graph` against `inputState` within `ctx`.
   *
   * Pure with respect to `(graph, inputState, ctx.seed, ctx.clock.now())`:
   * identical inputs produce an identical `ExecutionResult`.
   */
  execute(
    graph: ExecutionGraph,
    inputState: RuntimeState,
    ctx: ExecutionContext
  ): Promise<ExecutionResult>;
}
