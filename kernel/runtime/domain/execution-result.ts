/**
 * @kernel/runtime/domain/execution-result — the outcome of running an
 * `ExecutionGraph` through a `RuntimeExecutor`.
 *
 * `ExecutionResult` is a **pure projection** of `(graph, inputState, ctx)`:
 * given identical inputs and an identical context (same clock time, same
 * seed), two executions produce byte-identical results.
 */

import type { EventEnvelope } from "@kernel/events";
import type { NodeStatus } from "./execution-graph";
import type { RuntimeState } from "./runtime-state";

/** Per-node outcome within an execution. */
export interface ExecutionStepResult {
  readonly nodeId: string;
  readonly status: NodeStatus;
  /** Outputs the handler returned (present when `status === "completed"`). */
  readonly outputs?: Readonly<Record<string, unknown>>;
  /** Error message (present when `status === "failed"`). */
  readonly error?: string;
  /** Epoch-ms (from `ctx.clock.now()`) at the moment the node started. */
  readonly startedAt: number;
  /** Epoch-ms (from `ctx.clock.now()`) at the moment the node ended. */
  readonly endedAt: number;
}

/** Overall result of executing a graph. */
export interface ExecutionResult {
  readonly graphId: string;
  /** One entry per graph node, in execution order (deterministic topological). */
  readonly steps: readonly ExecutionStepResult[];
  /** All event envelopes emitted by all nodes, in emission order. */
  readonly eventsEmitted: readonly EventEnvelope[];
  /** Final threaded state after all nodes ran (outputs merged via `state.set`). */
  readonly finalState: RuntimeState;
  /** Epoch-ms at execution start (from `ctx.clock.now()`). */
  readonly startedAt: number;
  /** Epoch-ms at execution end (from `ctx.clock.now()`). */
  readonly endedAt: number;
  /** The graph's determinism seed, echoed for traceability. */
  readonly seed: number;
  /** `true` iff every node completed successfully. */
  readonly ok: boolean;
}
