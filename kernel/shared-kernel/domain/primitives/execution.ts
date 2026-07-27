/**
 * @kernel/shared-kernel/domain/primitives/execution — the Execution canonical
 * primitive.
 *
 * An `Execution` is the runtime act AND result of running an `ExecutionPlan`'s
 * `ExecutionGraph`. It is distinct from the plan: the plan is *what should
 * happen*; the execution is *what did happen*. The compiler produces a plan +
 * graph; the runtime produces an execution by running the graph.
 *
 * This distinction is load-bearing for the OS philosophy:
 *   - Protocols COMPILE work (Intent → ExecutionPlan + ExecutionGraph).
 *   - The runtime EXECUTES work (ExecutionGraph → Execution).
 *   - The runtime never creates work; the compiler never executes work.
 *
 * Domain-independent. No industry-specific fields.
 */

import type {
  ExecutionId,
  ExecutionPlanId,
  IntentId,
  ObservationId,
  DecisionId,
} from "../identifiers";
import type { UnknownState } from "../value-objects";

export type ExecutionStatus =
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type ExecutionStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

/** A single node's outcome within an execution. */
export interface ExecutionStep {
  readonly nodeId: string;
  readonly status: ExecutionStepStatus;
  readonly startedAt: number;
  readonly endedAt?: number;
  readonly outputs?: Readonly<Record<string, unknown>>;
  readonly error?: string;
}

/**
 * The realised execution of an `ExecutionPlan`. Produced by the runtime
 * executor; recorded as an immutable artifact. Carries the observations emitted
 * and decisions made during execution so the run is fully auditable.
 */
export interface Execution {
  readonly id: ExecutionId;
  readonly planId: ExecutionPlanId;
  readonly intentId: IntentId;
  readonly status: ExecutionStatus;
  readonly startedAt: number;
  readonly endedAt?: number;
  readonly steps: readonly ExecutionStep[];
  readonly observations: readonly ObservationId[];
  readonly decisions: readonly DecisionId[];
  readonly finalState?: UnknownState;
  /** Determinism anchor — the seed the graph was executed under. */
  readonly seed: number;
}
