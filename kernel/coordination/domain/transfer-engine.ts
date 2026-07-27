/**
 * @kernel/coordination/domain/transfer-engine — the TransferEngine PORT.
 *
 * A Transfer moves an Assignment from one Resource to another. Full provenance
 * is preserved. The engine has four transitions:
 *
 *   initiate → Transfer { status: "initiated" }
 *   accept   → Transfer { status: "accepted" }
 *   complete → Transfer { status: "completed" }  (the assignment is now owned by `toResourceId`)
 *   reject   → Transfer { status: "rejected" }
 *
 * Typical flow: a resource that cannot continue an assignment calls
 * `initiate` → the receiving resource calls `accept` → the originating
 * resource calls `complete` (after handing off any state) → the caller
 * updates the Assignment's `resourceId` to `toResourceId` (the assignment
 * engine itself does not own this; see `coordinate-work.ts`).
 *
 * Determinism rule: `now` is supplied by the caller; ids come from an injected
 * `RandomSource`. No `Date.now()`, no `Math.random()`.
 */

import type {
  AssignmentId,
  ResourceId,
  TransferId,
  TenantId,
} from "@kernel/shared-kernel";
import type {
  Transfer,
  ProvenanceRef,
} from "@kernel/shared-kernel";

/**
 * The TransferEngine PORT. Every method is PURE: returns a NEW `Transfer`.
 */
export interface TransferEngine {
  /** Begin a transfer of `assignmentId` from one resource to another. */
  initiate(
    assignmentId: AssignmentId,
    fromResourceId: ResourceId,
    toResourceId: ResourceId,
    reason: string,
    tenantId: TenantId,
    provenance: ProvenanceRef,
    now: number
  ): Transfer;

  /** The receiving resource accepts the transfer → `accepted`. */
  accept(transfer: Transfer, now: number): Transfer;

  /** The hand-off is complete → `completed`. */
  complete(transfer: Transfer, now: number): Transfer;

  /** The receiving resource rejects the transfer → `rejected`. */
  reject(transfer: Transfer, reason: string, now: number): Transfer;
}

export type { TransferId };
