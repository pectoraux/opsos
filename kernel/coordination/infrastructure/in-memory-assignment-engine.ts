/**
 * @kernel/coordination/infrastructure/in-memory-assignment-engine — the
 * in-memory `AssignmentEngine` implementation.
 *
 * Pure data structures + a per-instance counter for id minting. No
 * `Date.now()`, no `Math.random()`. All time comes from the `now` argument.
 *
 * Transition table:
 *   assign    → { status: "pending"   }
 *   accept    → { status: "accepted"  }   (precondition: pending)
 *   decline   → { status: "declined"  }   (precondition: pending)
 *   complete  → { status: "completed" }   (precondition: accepted)
 *   cancel    → { status: "cancelled" }   (precondition: non-terminal)
 */

import { asId, IllegalStateError } from "@kernel/shared-kernel";
import type {
  AssignmentId,
  Assignment,
  ProvenanceRef,
} from "@kernel/shared-kernel";
import type { AssignmentRequest, AssignmentEngine } from "../domain";

export class InMemoryAssignmentEngine implements AssignmentEngine {
  private counter = 0;

  assign(request: AssignmentRequest): Assignment {
    const id = this.mintAssignmentId(request.taskId, request.now);
    return {
      id,
      taskId: request.taskId,
      executionPlanId: request.executionPlanId,
      resourceId: request.resourceId,
      capabilityId: request.capabilityId,
      commitmentId: request.commitmentId,
      tenantId: request.tenantId,
      status: "pending",
      assignedAt: request.now,
      provenance: request.provenance,
    };
  }

  accept(assignment: Assignment, now: number): Assignment {
    if (assignment.status !== "pending") {
      throw new IllegalStateError(
        `Assignment '${assignment.id}' cannot be accepted from status '${assignment.status}'`
      );
    }
    return {
      ...assignment,
      status: "accepted",
      acceptedAt: now,
    };
  }

  decline(assignment: Assignment, _reason: string, _now: number): Assignment {
    if (assignment.status !== "pending") {
      throw new IllegalStateError(
        `Assignment '${assignment.id}' cannot be declined from status '${assignment.status}'`
      );
    }
    return {
      ...assignment,
      status: "declined",
    };
  }

  complete(assignment: Assignment, now: number): Assignment {
    if (assignment.status !== "accepted") {
      throw new IllegalStateError(
        `Assignment '${assignment.id}' cannot be completed from status '${assignment.status}' (expected 'accepted')`
      );
    }
    return {
      ...assignment,
      status: "completed",
      completedAt: now,
    };
  }

  cancel(assignment: Assignment, _reason: string, _now: number): Assignment {
    if (
      assignment.status === "completed" ||
      assignment.status === "cancelled"
    ) {
      throw new IllegalStateError(
        `Assignment '${assignment.id}' cannot be cancelled from terminal status '${assignment.status}'`
      );
    }
    return {
      ...assignment,
      status: "cancelled",
    };
  }

  // ── Internal: id minting ────────────────────────────────────────────────
  private mintAssignmentId(taskId: string, now: number): AssignmentId {
    this.counter += 1;
    return asId<"AssignmentId">(`asgn#${taskId}#${now}#${this.counter}`);
  }
}

export type { ProvenanceRef };
