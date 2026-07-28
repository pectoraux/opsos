/**
 * @kernel/workflow-runtime/application/start-workflow — use-case: start a
 * workflow instance from a registered definition.
 *
 * Mint a fresh `pending` instance via the registry, then transition it to
 * `running` with `currentSteps` set to the definition's entry steps (those
 * not referenced by any other step's `next`). Append a `started` event. If
 * the definition has no steps (or no entry steps), the instance is marked
 * `completed` immediately.
 *
 * Determinism: every timestamp flows from `input.now`. Instance id minting is
 * the registry's responsibility (deterministic given `now` + call order). No
 * `Date.now()`, no `Math.random()`.
 */

import { NotFoundError } from "@kernel/shared-kernel";

import type {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowRegistry,
} from "../domain";

/** Input to `StartWorkflow`. */
export interface StartWorkflowInput {
  readonly definitionId: string;
  readonly variables?: Readonly<Record<string, unknown>>;
  readonly now: number;
}

/** Result of `StartWorkflow`. */
export interface StartWorkflowResult {
  readonly instance: WorkflowInstance;
}

/** The use-case port. */
export interface StartWorkflow {
  execute(input: StartWorkflowInput): StartWorkflowResult;
}

/** Default implementation. Constructed with a `WorkflowRegistry`. */
export class StartWorkflowUseCase implements StartWorkflow {
  constructor(private readonly registry: WorkflowRegistry) {}

  execute(input: StartWorkflowInput): StartWorkflowResult {
    const def = this.registry.getDefinition(input.definitionId);
    if (!def) {
      throw new NotFoundError("WorkflowDefinition", input.definitionId);
    }

    const pending = this.registry.createInstance(
      input.definitionId,
      input.variables ?? {},
      input.now
    );

    const entry = computeEntrySteps(def);
    const started: WorkflowInstance =
      entry.length === 0
        ? {
            ...pending,
            status: "completed",
            currentSteps: [],
            history: [
              ...pending.history,
              { stepId: "", type: "started", timestamp: input.now },
              { stepId: "", type: "completed", timestamp: input.now },
            ],
            completedAt: input.now,
          }
        : {
            ...pending,
            status: "running",
            currentSteps: entry,
            history: [
              ...pending.history,
              { stepId: entry[0], type: "started", timestamp: input.now },
            ],
          };

    this.registry.updateInstance(started);
    return { instance: started };
  }
}

/**
 * Entry steps = steps not referenced by any other step's `next` array.
 * If every step is referenced (a pure cycle), fall back to the first step.
 */
function computeEntrySteps(def: WorkflowDefinition): readonly string[] {
  const referenced = new Set<string>();
  for (const s of def.steps) {
    for (const n of s.next) referenced.add(n);
  }
  const entry = def.steps.filter((s) => !referenced.has(s.id)).map((s) => s.id);
  if (entry.length === 0 && def.steps.length > 0) {
    return [def.steps[0].id];
  }
  return entry;
}
