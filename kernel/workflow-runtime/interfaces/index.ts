/**
 * @kernel/workflow-runtime — public surface.
 *
 * The Workflow Runtime — long-running operational workflow execution with
 * waiting, retries, timers, approvals, compensation, saga orchestration, and
 * recurring jobs. BPMN-like graphs over a deterministic kernel.
 *
 * Layered dependency direction:
 *   `interfaces/ → application/ → domain/`
 *   `infrastructure/ → application/ → domain/`
 *   `domain/` depends ONLY on `@kernel/shared-kernel`.
 *
 * Public surface:
 *   - Domain:        WorkflowDefinition, WorkflowStep, WorkflowStepType,
 *                    StepConfig, WorkflowTrigger, ErrorHandlingStrategy,
 *                    WorkflowInstance, WorkflowInstanceStatus, WorkflowEvent,
 *                    StepContext, StepResult, StepExecutor, SagaStep,
 *                    SagaInstance, SagaCoordinator, Timer, TimerRegistry,
 *                    RecurringJob, RecurringJobScheduler, CronExpression,
 *                    WorkflowRegistry, InstanceFilter
 *   - Application:   StartWorkflow, ResumeWorkflow, CancelWorkflow, ExecuteSaga
 *                    (+ UseCase classes)
 *   - Infrastructure: InMemoryWorkflowRegistry, InMemoryTimerRegistry,
 *                    InMemoryRecurringJobScheduler, DefaultStepExecutor,
 *                    DefaultSagaCoordinator, DefaultWorkflowEngine,
 *                    createWorkflowRuntime() bundle helper
 *
 * Determinism guarantees (enforced):
 *   - NO `Date.now()` / `Math.random()` anywhere in this module.
 *   - All time flows through the `now` argument.
 *   - All stores are pure data structures (Maps).
 *   - Instance/timer ids are derived from `(definitionId, now, counter)` —
 *     deterministic given the same `now` and call order.
 *   - Cron expansion uses `new Date(ms).getUTC*()` — a PURE function of the
 *     epoch-ms argument (no wall clock).
 *   - Condition evaluation is a pure, safe recursive-descent parser (no
 *     `eval`, no `Function`).
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
