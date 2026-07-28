/**
 * @kernel/coordination/infrastructure/in-memory-transfer-engine — the
 * in-memory `TransferEngine` implementation.
 *
 * Pure data structures + a per-instance counter for id minting. No
 * `Date.now()`, no `Math.random()`. All time comes from the `now` argument.
 *
 * Transition table:
 *   initiate → { status: "initiated" }
 *   accept   → { status: "accepted"  }   (precondition: initiated)
 *   complete → { status: "completed" }   (precondition: accepted)
 *   reject   → { status: "rejected"  }   (precondition: initiated)
 */

import { asId, IllegalStateError } from "@kernel/shared-kernel";
import type {
  AssignmentId,
  ResourceId,
  TransferId,
  TenantId,
  Transfer,
  ProvenanceRef,
} from "@kernel/shared-kernel";
import type { TransferEngine } from "../domain";

export class InMemoryTransferEngine implements TransferEngine {
  private counter = 0;

  initiate(
    assignmentId: AssignmentId,
    fromResourceId: ResourceId,
    toResourceId: ResourceId,
    reason: string,
    tenantId: TenantId,
    provenance: ProvenanceRef,
    now: number
  ): Transfer {
    const id = this.mintTransferId(assignmentId, now);
    return {
      id,
      assignmentId,
      fromResourceId,
      toResourceId,
      tenantId,
      reason,
      status: "initiated",
      initiatedAt: now,
      provenance,
    };
  }

  accept(transfer: Transfer, _now: number): Transfer {
    if (transfer.status !== "initiated") {
      throw new IllegalStateError(
        `Transfer '${transfer.id}' cannot be accepted from status '${transfer.status}'`
      );
    }
    return { ...transfer, status: "accepted" };
  }

  complete(transfer: Transfer, now: number): Transfer {
    if (transfer.status !== "accepted") {
      throw new IllegalStateError(
        `Transfer '${transfer.id}' cannot be completed from status '${transfer.status}' (expected 'accepted')`
      );
    }
    return { ...transfer, status: "completed", completedAt: now };
  }

  reject(transfer: Transfer, _reason: string, _now: number): Transfer {
    if (transfer.status !== "initiated") {
      throw new IllegalStateError(
        `Transfer '${transfer.id}' cannot be rejected from status '${transfer.status}'`
      );
    }
    return { ...transfer, status: "rejected" };
  }

  // ── Internal: id minting ────────────────────────────────────────────────
  private mintTransferId(assignmentId: AssignmentId, now: number): TransferId {
    this.counter += 1;
    return asId<"TransferId">(`xfer#${assignmentId}#${now}#${this.counter}`);
  }
}
