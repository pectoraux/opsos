/**
 * @kernel/workflow-runtime/infrastructure/in-memory-workflow-registry — the
 * reference `WorkflowRegistry` implementation.
 *
 * Definitions are keyed by `${id}#${version}`; `getDefinition(id)` (no version)
 * returns the highest registered version. Instances are keyed by `id`, minted
 * deterministically as `wfinst#${definitionId}#${now}#${counter}`.
 *
 * Pure `Map`s. No `Date.now()`, no `Math.random()`. `createInstance` returns a
 * fresh `pending` instance with empty `currentSteps` and empty `history`; the
 * `StartWorkflow` use-case transitions it to `running`.
 */

import type {
  InstanceFilter,
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowRegistry,
} from "../domain";

export class InMemoryWorkflowRegistry implements WorkflowRegistry {
  private readonly definitions = new Map<string, WorkflowDefinition>();
  private readonly instances = new Map<string, WorkflowInstance>();
  private counter = 0;

  registerDefinition(def: WorkflowDefinition): void {
    this.definitions.set(`${def.id}#${def.version}`, def);
  }

  getDefinition(id: string, version?: number): WorkflowDefinition | undefined {
    if (version !== undefined) {
      return this.definitions.get(`${id}#${version}`);
    }
    let best: WorkflowDefinition | undefined;
    let bestVersion = -1;
    for (const def of this.definitions.values()) {
      if (def.id === id && def.version > bestVersion) {
        best = def;
        bestVersion = def.version;
      }
    }
    return best;
  }

  listDefinitions(): readonly WorkflowDefinition[] {
    return Array.from(this.definitions.values());
  }

  createInstance(
    definitionId: string,
    variables: Readonly<Record<string, unknown>>,
    now: number
  ): WorkflowInstance {
    const def = this.getDefinition(definitionId);
    if (!def) {
      throw new Error(
        `Cannot create instance: definition '${definitionId}' not registered`
      );
    }
    this.counter += 1;
    const id = `wfinst#${definitionId}#${now}#${this.counter}`;
    const instance: WorkflowInstance = {
      id,
      definitionId: def.id,
      definitionVersion: def.version,
      status: "pending",
      currentSteps: [],
      variables: { ...variables },
      history: [],
      startedAt: now,
    };
    this.instances.set(id, instance);
    return instance;
  }

  getInstance(id: string): WorkflowInstance | undefined {
    return this.instances.get(id);
  }

  updateInstance(instance: WorkflowInstance): void {
    this.instances.set(instance.id, instance);
  }

  listInstances(filter?: InstanceFilter): readonly WorkflowInstance[] {
    const all = Array.from(this.instances.values());
    if (!filter) return all;
    return all.filter(
      (i) =>
        (filter.definitionId === undefined ||
          i.definitionId === filter.definitionId) &&
        (filter.status === undefined || i.status === filter.status)
    );
  }
}
