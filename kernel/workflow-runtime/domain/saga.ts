/**
 * @kernel/workflow-runtime/domain/saga — the saga primitive.
 *
 * A saga is a sequence of forward `action`s each paired with a `compensation`.
 * The `SagaCoordinator` executes actions forward; on any failure it executes
 * the compensations of already-completed steps in reverse order. This is the
 * canonical distributed-transaction pattern adapted to the deterministic
 * kernel.
 *
 * Determinism: the coordinator is a pure function of `(saga, context, now)`.
 * Action handlers (where real side effects live) are injected at construction
 * and must themselves be deterministic given their inputs.
 */

import type { StepContext } from "./step-executor";

/** A single saga step: a forward `action` and its `compensation` rollback. */
export interface SagaStep {
  readonly id: string;
  readonly action: string;
  readonly compensation: string;
}

/** The lifecycle states of a saga. */
export type SagaStatus =
  | "running"
  | "completed"
  | "compensating"
  | "compensated"
  | "failed";

/** A materialised saga execution. */
export interface SagaInstance {
  readonly id: string;
  readonly steps: readonly SagaStep[];
  /** Step ids that completed forward execution (in order). */
  readonly completedSteps: readonly string[];
  readonly status: SagaStatus;
  readonly error?: string;
}

/**
 * The port implemented by `DefaultSagaCoordinator`. `execute` runs the saga
 * forward (auto-compensating on failure); `compensate` manually triggers
 * compensation of a previously-executed saga.
 */
export interface SagaCoordinator {
  execute(
    saga: SagaInstance,
    context: StepContext,
    now: number
  ): SagaInstance;
  compensate(sagaId: string, now: number): SagaInstance;
}
