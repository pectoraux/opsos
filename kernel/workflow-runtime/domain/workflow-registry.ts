/**
 * @kernel/workflow-runtime/domain/workflow-registry — the port that stores
 * workflow definitions and instances.
 *
 * The registry is the single source of truth for both blueprints
 * (`WorkflowDefinition`, keyed by `(id, version)`) and executions
 * (`WorkflowInstance`, keyed by `id`). `createInstance` mints a fresh
 * `pending` instance from a registered definition; the engine advances it via
 * `updateInstance`.
 *
 * Determinism: the registry is a pure data structure. Instance ids are minted
 * from `definitionId + now + counter` — deterministic given the same `now` and
 * the same call order. No `Date.now()`, no `Math.random()`.
 */

import type { WorkflowDefinition } from "./workflow-definition";
import type {
  WorkflowInstance,
  WorkflowInstanceStatus,
} from "./workflow-instance";

/** Optional filter for `listInstances`. */
export interface InstanceFilter {
  readonly definitionId?: string;
  readonly status?: WorkflowInstanceStatus;
}

/** The port implemented by `InMemoryWorkflowRegistry`. */
export interface WorkflowRegistry {
  /** Register or replace a definition (keyed by `(id, version)`). */
  registerDefinition(def: WorkflowDefinition): void;
  /** Look up a definition; `version` defaults to the highest registered. */
  getDefinition(id: string, version?: number): WorkflowDefinition | undefined;
  /** All registered definitions (snapshot, read-only). */
  listDefinitions(): readonly WorkflowDefinition[];
  /** Mint a fresh `pending` instance of the given definition. */
  createInstance(
    definitionId: string,
    variables: Readonly<Record<string, unknown>>,
    now: number
  ): WorkflowInstance;
  /** Look up an instance (read-only). */
  getInstance(id: string): WorkflowInstance | undefined;
  /** Replace an instance (idempotent on id). */
  updateInstance(instance: WorkflowInstance): void;
  /** All instances, optionally filtered (snapshot, read-only). */
  listInstances(filter?: InstanceFilter): readonly WorkflowInstance[];
}
