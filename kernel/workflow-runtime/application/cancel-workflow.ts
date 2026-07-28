/**
 * @kernel/workflow-runtime/application/cancel-workflow — use-case: cancel a
 * running or waiting workflow instance.
 *
 * Transitions the instance to `cancelled`, stamps `completedAt`, and appends a
 * `cancelled` event for each currently-active step. If a `TimerRegistry` is
 * injected, all pending timers bound to the instance are also cancelled so
 * they do not fire later and resurrect the instance.
 *
 * Determinism: every timestamp flows from `input.now`. No `Date.now()`.
 */

import { IllegalStateError, NotFoundError } from "@kernel/shared-kernel";

import type {
  TimerRegistry,
  WorkflowInstance,
  WorkflowRegistry,
} from "../domain";

/** Input to `CancelWorkflow`. */
export interface CancelWorkflowInput {
  readonly instanceId: string;
  readonly reason?: string;
  readonly now: number;
}

/** Result of `CancelWorkflow`. */
export interface CancelWorkflowResult {
  readonly instance: WorkflowInstance;
  readonly cancelledTimerIds: readonly string[];
}

/** The use-case port. */
export interface CancelWorkflow {
  execute(input: CancelWorkflowInput): CancelWorkflowResult;
}

/** Default implementation. */
export class CancelWorkflowUseCase implements CancelWorkflow {
  constructor(
    private readonly registry: WorkflowRegistry,
    private readonly timers?: TimerRegistry
  ) {}

  execute(input: CancelWorkflowInput): CancelWorkflowResult {
    const current = this.registry.getInstance(input.instanceId);
    if (!current) {
      throw new NotFoundError("WorkflowInstance", input.instanceId);
    }
    if (
      current.status === "completed" ||
      current.status === "failed" ||
      current.status === "cancelled" ||
      current.status === "timed-out"
    ) {
      throw new IllegalStateError(
        `Cannot cancel instance '${input.instanceId}' in terminal status '${current.status}'`
      );
    }

    // Cancel any pending timers bound to this instance.
    const cancelledTimerIds: string[] = [];
    if (this.timers) {
      for (const t of this.timers.list()) {
        if (
          t.workflowInstanceId === input.instanceId &&
          t.status === "pending"
        ) {
          this.timers.cancel(t.id);
          cancelledTimerIds.push(t.id);
        }
      }
    }

    const cancelledEvents = current.currentSteps.map((stepId) => ({
      stepId,
      type: "cancelled" as const,
      timestamp: input.now,
      data: input.reason ? { reason: input.reason } : undefined,
    }));

    const cancelled: WorkflowInstance = {
      ...current,
      status: "cancelled",
      currentSteps: [],
      completedAt: input.now,
      history: [...current.history, ...cancelledEvents],
    };
    this.registry.updateInstance(cancelled);
    return { instance: cancelled, cancelledTimerIds };
  }
}
