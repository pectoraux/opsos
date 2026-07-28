/**
 * @kernel/workflow-runtime/domain/workflow-instance — a single materialised
 * execution of a `WorkflowDefinition`.
 *
 * The instance is an immutable, event-sourced-style record: every state
 * transition appends a `WorkflowEvent` to `history` and produces a new
 * instance value (the registry stores the latest). `currentSteps` is the set
 * of step ids currently active (multiple for parallel branches). `variables`
 * is the merged, read-only execution state bag.
 *
 * Determinism: every timestamp flows from the caller's `now`. No
 * `Date.now()`, no `Math.random()`. Instance ids are minted by the registry
 * from `now` + a per-registry counter.
 */

/** The lifecycle states a workflow instance may occupy. */
export type WorkflowInstanceStatus =
  | "pending"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed-out";

/** The kinds of events recorded in a workflow's `history`. */
export type WorkflowEventType =
  | "started"
  | "completed"
  | "failed"
  | "waiting"
  | "resumed"
  | "cancelled"
  | "timed-out"
  | "compensated";

/** A single recorded event in a workflow instance's history. */
export interface WorkflowEvent {
  readonly stepId: string;
  readonly type: WorkflowEventType;
  readonly timestamp: number;
  readonly data?: Readonly<Record<string, unknown>>;
}

/** A materialised execution of a workflow definition. */
export interface WorkflowInstance {
  readonly id: string;
  readonly definitionId: string;
  readonly definitionVersion: number;
  readonly status: WorkflowInstanceStatus;
  /** Step ids currently active (≥1 while running/waiting; empty when terminal). */
  readonly currentSteps: readonly string[];
  /** The merged execution state bag. Read-only; updated by the engine. */
  readonly variables: Readonly<Record<string, unknown>>;
  /** Append-only event log. */
  readonly history: readonly WorkflowEvent[];
  readonly startedAt: number;
  readonly completedAt?: number;
  readonly error?: string;
}

/**
 * The workflow engine port. `tick(now)` advances time: fires due timers, spawns
 * due recurring jobs, executes running instances' current steps, and resumes
 * waiting instances whose resume condition is met. `executeStep` executes (or
 * resumes) a single step. Both return the affected instance(s).
 */
export interface WorkflowEngine {
  /** Advance the runtime; returns every instance touched this tick. */
  tick(now: number): readonly WorkflowInstance[];
  /** Execute (or resume) a single step; returns the updated instance. */
  executeStep(instanceId: string, stepId: string, now: number): WorkflowInstance;
}
