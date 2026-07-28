/**
 * @kernel/workflow-runtime/infrastructure — barrel.
 *
 * The infrastructure layer of the Workflow Runtime. Concrete in-memory
 * implementations of every port. Pure data structures; no `Date.now()`, no
 * `Math.random()`. Suitable for tests, deterministic replay, and as reference
 * implementations for protocol authors.
 *
 * Public surface:
 *   - InMemoryWorkflowRegistry
 *   - InMemoryTimerRegistry
 *   - InMemoryRecurringJobScheduler
 *   - DefaultStepExecutor (+ DefaultStepExecutorDeps, evaluateCondition)
 *   - DefaultSagaCoordinator (+ ActionHandler)
 *   - DefaultWorkflowEngine (+ DefaultWorkflowEngineDeps)
 *   - createWorkflowRuntime() bundle helper
 */

import { InMemoryWorkflowRegistry } from "./in-memory-workflow-registry";
import { InMemoryTimerRegistry } from "./in-memory-timer-registry";
import { InMemoryRecurringJobScheduler } from "./in-memory-recurring-scheduler";
import { DefaultStepExecutor } from "./default-step-executor";
import { DefaultSagaCoordinator } from "./default-saga-coordinator";
import { DefaultWorkflowEngine } from "./default-workflow-engine";

export { InMemoryWorkflowRegistry } from "./in-memory-workflow-registry";
export { InMemoryTimerRegistry } from "./in-memory-timer-registry";
export { InMemoryRecurringJobScheduler } from "./in-memory-recurring-scheduler";
export {
  DefaultStepExecutor,
  evaluateCondition,
} from "./default-step-executor";
export type { DefaultStepExecutorDeps } from "./default-step-executor";
export { DefaultSagaCoordinator } from "./default-saga-coordinator";
export type { ActionHandler } from "./default-saga-coordinator";
export { DefaultWorkflowEngine } from "./default-workflow-engine";
export type { DefaultWorkflowEngineDeps } from "./default-workflow-engine";

/**
 * A convenience bundle of every in-memory workflow-runtime component. Construct
 * one per session and pass the components individually (or as a bundle) to
 * use-cases and the engine.
 */
export interface WorkflowRuntime {
  readonly registry: InMemoryWorkflowRegistry;
  readonly timerRegistry: InMemoryTimerRegistry;
  readonly recurringScheduler: InMemoryRecurringJobScheduler;
  readonly sagaCoordinator: DefaultSagaCoordinator;
  readonly stepExecutor: DefaultStepExecutor;
  readonly engine: DefaultWorkflowEngine;
}

/**
 * Construct a fresh, fully-wired in-memory workflow runtime. Every component is
 * injected into every dependent: the step executor gets the timer registry,
 * saga coordinator, and workflow registry; the engine gets the registry, step
 * executor, timer registry, and recurring scheduler. Optional `taskHandlers`
 * and `sagaHandlers` let callers inject action handlers for tasks and saga
 * actions.
 */
export function createWorkflowRuntime(opts?: {
  readonly taskHandlers?: Map<string, (action: string, ctx: import("../domain").StepContext, now: number) => string | null>;
  readonly sagaHandlers?: Map<string, (action: string, ctx: import("../domain").StepContext, now: number) => string | null>;
}): WorkflowRuntime {
  const registry = new InMemoryWorkflowRegistry();
  const timerRegistry = new InMemoryTimerRegistry();
  const recurringScheduler = new InMemoryRecurringJobScheduler();
  const sagaCoordinator = new DefaultSagaCoordinator(opts?.sagaHandlers);
  const stepExecutor = new DefaultStepExecutor({
    taskHandlers: opts?.taskHandlers,
    sagaCoordinator,
    timerRegistry,
    workflowRegistry: registry,
  });
  const engine = new DefaultWorkflowEngine({
    registry,
    stepExecutor,
    sagaCoordinator,
    timerRegistry,
    recurringScheduler,
  });
  return {
    registry,
    timerRegistry,
    recurringScheduler,
    sagaCoordinator,
    stepExecutor,
    engine,
  };
}
