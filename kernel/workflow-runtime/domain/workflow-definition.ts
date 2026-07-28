/**
 * @kernel/workflow-runtime/domain/workflow-definition — the immutable blueprint
 * for a long-running operational workflow.
 *
 * A `WorkflowDefinition` is a versioned, BPMN-like graph of `WorkflowStep`s.
 * Steps are connected by `next` (a list of successor step ids — empty list means
 * terminal). Each step has a `type` (task | wait | timer | approval | branch |
 * parallel | saga | compensation | subprocess | loop | gate) and a `config`
 * bag whose shape depends on the type.
 *
 * This file defines ONLY pure types — no behaviour. The `WorkflowRegistry`
 * port (./workflow-registry) stores definitions; the `StepExecutor` port
 * (./step-executor) interprets them.
 *
 * Determinism: types carry no time, no randomness. All temporal values
 * (`durationMs`, `timeoutMs`, `retryDelayMs`) are millisecond offsets sourced
 * from the caller's `now` at execution time.
 */

/** The set of step types the runtime can execute. */
export type WorkflowStepType =
  | "task"
  | "wait"
  | "timer"
  | "approval"
  | "branch"
  | "parallel"
  | "saga"
  | "compensation"
  | "subprocess"
  | "loop"
  | "gate";

/**
 * Per-step configuration. All fields optional; which fields are meaningful
 * depends on the step `type`:
 *   - task:         `action` (the action identifier to perform).
 *   - wait:         `durationMs` (how long to wait before resuming).
 *   - timer:        `durationMs` (when the timer fires).
 *   - approval:     `action` (the approval request identifier).
 *   - branch:       `condition` (boolean expression); `branches[0]`=then,
 *                    `branches[1]`=else.
 *   - parallel:     `branches` (the step ids to run concurrently).
 *   - saga:         `branches` (the saga step ids — see SagaStep).
 *   - compensation: `action` (the compensation action to record).
 *   - subprocess:   `subprocessId` (the definition id of the child workflow);
 *                    `variables` (inputs to the child).
 *   - loop:         `condition` (loop-while-true expression).
 *   - gate:         `condition` (wait-until-true expression).
 *
 * Retry / timeout fields apply to any step:
 *   - `maxRetries`   — failure retry count (default 0).
 *   - `retryDelayMs` — delay between retries.
 *   - `timeoutMs`    — per-execution wall-clock timeout.
 */
export interface StepConfig {
  readonly action?: string;
  readonly durationMs?: number;
  readonly condition?: string;
  readonly branches?: readonly string[];
  readonly maxRetries?: number;
  readonly retryDelayMs?: number;
  readonly timeoutMs?: number;
  readonly subprocessId?: string;
  readonly variables?: Readonly<Record<string, unknown>>;
}

/** A single node in the workflow graph. */
export interface WorkflowStep {
  readonly id: string;
  readonly name: string;
  readonly type: WorkflowStepType;
  readonly config: StepConfig;
  /** Successor step ids. Empty array = terminal step. */
  readonly next: readonly string[];
  /** Per-step wall-clock timeout (overrides `config.timeoutMs`). */
  readonly timeoutMs?: number;
}

/** How a workflow may be triggered. */
export type WorkflowTriggerKind =
  | "manual"
  | "event"
  | "schedule"
  | "webhook"
  | "condition";

/** A trigger declaration on a workflow definition. */
export interface WorkflowTrigger {
  readonly kind: WorkflowTriggerKind;
  readonly params: Readonly<Record<string, unknown>>;
}

/** The error-handling strategy applied when a step fails terminally. */
export type ErrorHandlingStrategy =
  | "stop"
  | "retry"
  | "compensate"
  | "continue"
  | "escalate";

/**
 * The full workflow blueprint. Immutable once registered; evolving a workflow
 * means registering a new `version`.
 */
export interface WorkflowDefinition {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly steps: readonly WorkflowStep[];
  readonly triggers: readonly WorkflowTrigger[];
  readonly errorHandling: ErrorHandlingStrategy;
  readonly description?: string;
}
