/**
 * @kernel/workflow-runtime/domain — barrel.
 *
 * The domain layer of the Workflow Runtime. Pure types + ports only — no
 * behaviour, no I/O. Depends ONLY on `@kernel/shared-kernel` (and even that
 * only for the most generic value-object shapes; this module's contracts are
 * self-contained).
 *
 * Public surface:
 *   - Definition:   WorkflowDefinition, WorkflowStep, WorkflowStepType,
 *                   StepConfig, WorkflowTrigger, WorkflowTriggerKind,
 *                   ErrorHandlingStrategy
 *   - Instance:     WorkflowInstance, WorkflowInstanceStatus, WorkflowEvent,
 *                   WorkflowEventType
 *   - Step executor:StepContext, StepResult, StepResultStatus, StepExecutor
 *   - Saga:         SagaStep, SagaInstance, SagaStatus, SagaCoordinator
 *   - Timer:        Timer, TimerStatus, TimerRegistry
 *   - Recurring:    RecurringJob, RecurringJobStatus, RecurringSchedule,
 *                   CronExpression, IntervalMs, RecurringJobScheduler
 *   - Registry:     WorkflowRegistry, InstanceFilter
 *
 * Determinism: no `Date.now()`, no `Math.random()` anywhere in this layer.
 * Every timestamp flows from the caller's `now` argument.
 */

// ── Definition ──────────────────────────────────────────────────────────────
export type {
  WorkflowStepType,
  StepConfig,
  WorkflowStep,
  WorkflowTriggerKind,
  WorkflowTrigger,
  ErrorHandlingStrategy,
  WorkflowDefinition,
} from "./workflow-definition";

// ── Instance ────────────────────────────────────────────────────────────────
export type {
  WorkflowInstanceStatus,
  WorkflowEventType,
  WorkflowEvent,
  WorkflowInstance,
  WorkflowEngine,
} from "./workflow-instance";

// ── Step executor ───────────────────────────────────────────────────────────
export type {
  StepContext,
  StepResultStatus,
  StepResult,
  StepExecutor,
} from "./step-executor";

// ── Saga ────────────────────────────────────────────────────────────────────
export type {
  SagaStep,
  SagaStatus,
  SagaInstance,
  SagaCoordinator,
} from "./saga";

// ── Timer ───────────────────────────────────────────────────────────────────
export type { TimerStatus, Timer, TimerRegistry } from "./timer";

// ── Recurring ───────────────────────────────────────────────────────────────
export type {
  CronExpression,
  IntervalMs,
  RecurringSchedule,
  RecurringJobStatus,
  RecurringJob,
  RecurringJobScheduler,
} from "./recurring-job";

// ── Registry ────────────────────────────────────────────────────────────────
export type { InstanceFilter, WorkflowRegistry } from "./workflow-registry";
