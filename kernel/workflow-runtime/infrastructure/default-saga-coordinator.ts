/**
 * @kernel/workflow-runtime/infrastructure/default-saga-coordinator — the
 * reference `SagaCoordinator` implementation.
 *
 * Executes a saga's forward `action`s in order; on any failure, executes the
 * `compensation` of every completed step in reverse order (all-or-nothing
 * within a single `execute` call). Action and compensation handlers are
 * injected via an optional `Map<actionId, ActionHandler>`; an unregistered
 * action succeeds by default (the deterministic core has no inherent side
 * effects — real adapters plug in here).
 *
 * `compensate(sagaId, now)` re-triggers compensation of a previously-executed
 * saga (e.g. for manual rollback). It is a no-op if the saga is already
 * `compensated` or `failed`.
 *
 * Determinism: pure functions of `(saga, context, now)`. No `Date.now()`.
 */

import type {
  SagaCoordinator,
  SagaInstance,
  SagaStep,
  StepContext,
} from "../domain";

/**
 * An action / compensation handler. Returns `null` on success or an error
 * string on failure. The coordinator never throws — failures are values.
 */
export type ActionHandler = (
  action: string,
  context: StepContext,
  now: number
) => string | null;

export class DefaultSagaCoordinator implements SagaCoordinator {
  private readonly sagas = new Map<string, SagaInstance>();
  private readonly handlers: Map<string, ActionHandler>;

  constructor(handlers?: Map<string, ActionHandler>) {
    this.handlers = handlers ?? new Map();
  }

  execute(
    saga: SagaInstance,
    context: StepContext,
    now: number
  ): SagaInstance {
    let current: SagaInstance = { ...saga, status: "running", completedSteps: [...saga.completedSteps] };
    this.sagas.set(current.id, current);

    for (const step of current.steps) {
      if (current.completedSteps.includes(step.id)) continue;
      const err = this.runAction(step.action, context, now);
      if (err !== null) {
        // Forward failure → compensate completed steps in reverse.
        const compensated = this.compensateInternal(current, context, now);
        const failed: SagaInstance = {
          ...compensated,
          status: compensated.status === "compensated" ? "compensated" : "failed",
          error: err,
        };
        this.sagas.set(failed.id, failed);
        return failed;
      }
      current = {
        ...current,
        completedSteps: [...current.completedSteps, step.id],
      };
      this.sagas.set(current.id, current);
    }

    const done: SagaInstance = { ...current, status: "completed" };
    this.sagas.set(done.id, done);
    return done;
  }

  compensate(sagaId: string, now: number): SagaInstance {
    const saga = this.sagas.get(sagaId);
    if (!saga) {
      return {
        id: sagaId,
        steps: [],
        completedSteps: [],
        status: "failed",
        error: `saga '${sagaId}' not found`,
      };
    }
    if (saga.status === "compensated") return saga;
    if (saga.status === "failed") return saga;
    // For a completed saga, re-run compensation. We need a context; the
    // coordinator does not store it, so synthesize a minimal one from the
    // saga id (compensation handlers that depend on context should not be
    // invoked via this path — use execute's automatic compensation instead).
    const ctx: StepContext = {
      instanceId: "",
      stepId: "",
      variables: {},
      now,
    };
    const compensated = this.compensateInternal(saga, ctx, now);
    this.sagas.set(compensated.id, compensated);
    return compensated;
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private runAction(
    action: string,
    context: StepContext,
    now: number
  ): string | null {
    const h = this.handlers.get(action);
    return h ? h(action, context, now) : null;
  }

  private compensateInternal(
    saga: SagaInstance,
    context: StepContext,
    now: number
  ): SagaInstance {
    const completed = saga.steps.filter((s) =>
      saga.completedSteps.includes(s.id)
    );
    // Reverse order.
    const toCompensate: SagaStep[] = [...completed].reverse();

    let current: SagaInstance = { ...saga, status: "compensating" };
    this.sagas.set(current.id, current);

    for (const step of toCompensate) {
      const err = this.runAction(step.compensation, context, now);
      if (err !== null) {
        const failed: SagaInstance = {
          ...current,
          status: "failed",
          error: `compensation of '${step.id}' failed: ${err}`,
        };
        this.sagas.set(failed.id, failed);
        return failed;
      }
      // Remove the compensated step from completedSteps.
      current = {
        ...current,
        completedSteps: current.completedSteps.filter(
          (id) => id !== step.id
        ),
      };
      this.sagas.set(current.id, current);
    }

    const done: SagaInstance = {
      ...current,
      status: "compensated",
      completedSteps: [],
    };
    this.sagas.set(done.id, done);
    return done;
  }
}
