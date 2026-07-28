/**
 * @kernel/workflow-runtime/application/execute-saga — use-case: execute a saga
 * with automatic compensation on failure.
 *
 * Thin orchestration over `SagaCoordinator.execute`. The coordinator runs the
 * saga's forward actions; on any failure it runs the completed steps'
 * compensations in reverse order. The use-case returns the final
 * `SagaInstance` (status `completed`, `compensated`, or `failed`).
 *
 * Determinism: every timestamp flows from `input.now`. Action handlers
 * (injected into the coordinator) must themselves be deterministic.
 */

import type {
  SagaCoordinator,
  SagaInstance,
  StepContext,
} from "../domain";

/** Input to `ExecuteSaga`. */
export interface ExecuteSagaInput {
  readonly saga: SagaInstance;
  readonly context: StepContext;
  readonly now: number;
}

/** Result of `ExecuteSaga`. */
export interface ExecuteSagaResult {
  readonly saga: SagaInstance;
}

/** The use-case port. */
export interface ExecuteSaga {
  execute(input: ExecuteSagaInput): ExecuteSagaResult;
}

/** Default implementation. Constructed with a `SagaCoordinator`. */
export class ExecuteSagaUseCase implements ExecuteSaga {
  constructor(private readonly coordinator: SagaCoordinator) {}

  execute(input: ExecuteSagaInput): ExecuteSagaResult {
    const saga = this.coordinator.execute(
      input.saga,
      input.context,
      input.now
    );
    return { saga };
  }
}
