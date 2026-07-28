/**
 * @kernel/workflow-runtime/application/resume-workflow — use-case: resume a
 * waiting workflow instance.
 *
 * A waiting instance (status `waiting`, e.g. blocked on an approval, timer, or
 * gate) is transitioned back to `running`, a `resumed` event is appended, and
 * any provided `variables` are merged into the instance's variable bag. The
 * engine's next `tick` (or an explicit `executeStep`) re-executes the
 * resumed step.
 *
 * Determinism: every timestamp flows from `input.now`. No `Date.now()`.
 */

import { IllegalStateError, NotFoundError } from "@kernel/shared-kernel";

import type { WorkflowInstance, WorkflowRegistry } from "../domain";

/** Input to `ResumeWorkflow`. */
export interface ResumeWorkflowInput {
  readonly instanceId: string;
  /** Step to resume; defaults to `instance.currentSteps[0]`. */
  readonly stepId?: string;
  /** Variables merged into the instance (shallow merge, input wins). */
  readonly variables?: Readonly<Record<string, unknown>>;
  readonly now: number;
}

/** Result of `ResumeWorkflow`. */
export interface ResumeWorkflowResult {
  readonly instance: WorkflowInstance;
}

/** The use-case port. */
export interface ResumeWorkflow {
  execute(input: ResumeWorkflowInput): ResumeWorkflowResult;
}

/** Default implementation. Constructed with a `WorkflowRegistry`. */
export class ResumeWorkflowUseCase implements ResumeWorkflow {
  constructor(private readonly registry: WorkflowRegistry) {}

  execute(input: ResumeWorkflowInput): ResumeWorkflowResult {
    const current = this.registry.getInstance(input.instanceId);
    if (!current) {
      throw new NotFoundError("WorkflowInstance", input.instanceId);
    }
    if (current.status !== "waiting") {
      throw new IllegalStateError(
        `Cannot resume instance '${input.instanceId}' in status '${current.status}' (expected 'waiting')`
      );
    }

    const stepId = input.stepId ?? current.currentSteps[0] ?? "";
    const mergedVariables = input.variables
      ? { ...current.variables, ...input.variables }
      : current.variables;

    const resumed: WorkflowInstance = {
      ...current,
      status: "running",
      variables: mergedVariables,
      history: [
        ...current.history,
        { stepId, type: "resumed", timestamp: input.now },
      ],
    };
    this.registry.updateInstance(resumed);
    return { instance: resumed };
  }
}
