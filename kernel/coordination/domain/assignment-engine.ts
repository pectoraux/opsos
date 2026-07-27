/**
 * @kernel/coordination/domain/assignment-engine — the AssignmentEngine PORT.
 *
 * An Assignment connects a Task (or ExecutionPlan) to a Resource via a
 * Capability, optionally backed by a Commitment. The AssignmentEngine has five
 * transitions:
 *
 *   assign    → Assignment { status: "pending"  }
 *   accept    → Assignment { status: "accepted" }
 *   decline   → Assignment { status: "declined" }
 *   complete  → Assignment { status: "completed" }
 *   cancel    → Assignment { status: "cancelled" }
 *
 * After `accept`, the resource is expected to perform the work; on completion,
 * the engine marks the assignment `completed` (and the caller is responsible
 * for invoking `CommitmentEngine.fulfill` on the linked commitment, if any).
 *
 * Determinism rule: `now` is supplied by the caller; ids come from an injected
 * `RandomSource`. No `Date.now()`, no `Math.random()`.
 */

import type {
  TaskId,
  ExecutionPlanId,
  ResourceId,
  CapabilityId,
  CommitmentId,
  AssignmentId,
  TenantId,
} from "@kernel/shared-kernel";
import type {
  Assignment,
  ProvenanceRef,
} from "@kernel/shared-kernel";

/**
 * The full request to create an Assignment. Pure data.
 */
export interface AssignmentRequest {
  readonly taskId: TaskId;
  readonly executionPlanId?: ExecutionPlanId;
  readonly resourceId: ResourceId;
  readonly capabilityId: CapabilityId;
  readonly commitmentId?: CommitmentId;
  readonly tenantId: TenantId;
  readonly provenance: ProvenanceRef;
  readonly now: number;
}

/**
 * The AssignmentEngine PORT. Every method is PURE: returns a NEW `Assignment`.
 */
export interface AssignmentEngine {
  /**
   * Create a `pending` Assignment. The resource has been chosen (e.g. by the
   * matching engine); the assignment awaits the resource's accept/decline.
   */
  assign(request: AssignmentRequest): Assignment;

  /** Resource accepts the assignment → `accepted`. */
  accept(assignment: Assignment, now: number): Assignment;

  /** Resource declines the assignment → `declined`, with a reason. */
  decline(assignment: Assignment, reason: string, now: number): Assignment;

  /** Mark the assignment `completed` (work finished). */
  complete(assignment: Assignment, now: number): Assignment;

  /** Cancel the assignment (any non-terminal status) → `cancelled`. */
  cancel(assignment: Assignment, reason: string, now: number): Assignment;
}

export type { AssignmentId };
