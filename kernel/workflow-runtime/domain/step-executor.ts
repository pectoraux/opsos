/**
 * @kernel/workflow-runtime/domain/step-executor — the port that interprets a
 * single `WorkflowStep` against a `StepContext` and returns a `StepResult`.
 *
 * The executor is the seam where step-type semantics live. The
 * `DefaultStepExecutor` (infrastructure) implements every step type; protocol
 * authors may provide their own executor to extend the runtime.
 *
 * Determinism: the executor is a pure function of `(step, context)`. It does
 * not read the clock directly (uses `context.now`), does not call
 * `Math.random()`, and does not mutate the instance — side effects (registry
 * updates, timer scheduling) are returned in `StepResult` for the engine to
 * apply. Where the executor needs to delegate (saga → SagaCoordinator,
 * subprocess → WorkflowRegistry), those deps are injected at construction.
 */

import type { WorkflowStep } from "./workflow-definition";

/** The execution context handed to a step executor. */
export interface StepContext {
  readonly instanceId: string;
  readonly stepId: string;
  /** The instance's current variables (read-only). */
  readonly variables: Readonly<Record<string, unknown>>;
  /** Caller-sourced epoch-millis. */
  readonly now: number;
}

/** The outcome status of executing a step. */
export type StepResultStatus =
  | "completed"
  | "failed"
  | "waiting"
  | "timed-out";

/**
 * The result of executing a single step.
 *   - `completed`  — the step finished; `output` is merged into the instance's
 *                     variables. The engine advances to `step.next` unless
 *                     `output["__wf.next__"]` overrides.
 *   - `failed`     — the step failed; `error` describes why. The engine
 *                     applies the workflow's error-handling strategy.
 *   - `waiting`    — the step is blocked (wait/timer/approval/gate/subprocess).
 *                     `waitUntil` (epoch-ms) is when the engine may resume it;
 *                     undefined means resume only on external signal.
 *   - `timed-out`  — the step exceeded its `timeoutMs`.
 */
export interface StepResult {
  readonly status: StepResultStatus;
  readonly output?: Readonly<Record<string, unknown>>;
  readonly error?: string;
  readonly waitUntil?: number;
}

/** The port implemented by `DefaultStepExecutor` and any custom executor. */
export interface StepExecutor {
  execute(step: WorkflowStep, context: StepContext): StepResult;
}
