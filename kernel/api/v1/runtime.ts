/**
 * @kernel/api/v1 — RUNTIME public surface (FROZEN).
 *
 * The deterministic execution engine contract: clocks, randomness, execution
 * context, execution graph, and the executor.
 */
export type {
  ExecutionContext,
  ExecutionContextOverrides,
  ExecutionContextDeps,
  ExecutionGraph,
  ExecutionNode,
  ExecutionEdge,
  NodeStatus,
  OperationContext,
  OperationResult,
  OperationHandler,
  OperationRef,
  OperationRegistry,
  RuntimeState,
  ExecutionResult,
  ExecutionStepResult,
  RuntimeExecutor,
} from "@kernel/runtime";

export {
  ExecutionContextBuilder,
  createExecutionContext,
  createRuntimeState,
  topologicalOrder,
  createOperationContext,
  SystemRuntimeClock,
  FixedRuntimeClock,
  SeededRandomSource,
  DeterministicRuntimeExecutor,
  createOperationRegistry,
} from "@kernel/runtime";

export type { DeterministicRuntimeExecutorDeps } from "@kernel/runtime";
