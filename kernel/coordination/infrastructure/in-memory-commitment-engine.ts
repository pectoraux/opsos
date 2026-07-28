/**
 * @kernel/coordination/infrastructure/in-memory-commitment-engine — the
 * in-memory `CommitmentEngine` implementation.
 *
 * Pure data structures. No `Date.now()`, no `Math.random()`. All time comes
 * from the `now` argument.
 *
 * Transition table:
 *   create   → { status: "active" }    (precondition: reservation.confirmed + commitmentId set)
 *   fulfill  → { status: "fulfilled" } (precondition: active)
 *   release  → { status: "released" }  (precondition: active)
 *
 * `create` consumes a confirmed `Reservation` whose `commitmentId` was minted
 * by `ReservationEngine.confirm`. The resulting `Commitment` carries that
 * exact `id`, plus `reservationId` for lineage.
 */

import { IllegalStateError } from "@kernel/shared-kernel";
import type {
  Commitment,
  Reservation,
  ProvenanceRef,
} from "@kernel/shared-kernel";
import type { CommitmentEngine } from "../domain";

export class InMemoryCommitmentEngine implements CommitmentEngine {
  create(
    reservation: Reservation,
    provenance: ProvenanceRef,
    now: number
  ): Commitment {
    if (reservation.status !== "confirmed") {
      throw new IllegalStateError(
        `Cannot create commitment from reservation '${reservation.id}' with status '${reservation.status}' (expected 'confirmed')`
      );
    }
    if (reservation.commitmentId === undefined) {
      throw new IllegalStateError(
        `Cannot create commitment from reservation '${reservation.id}': commitmentId not set`
      );
    }
    return {
      id: reservation.commitmentId,
      resourceId: reservation.resourceId,
      tenantId: reservation.tenantId,
      capabilityType: reservation.capabilityType,
      quantity: reservation.quantity,
      window: reservation.window,
      status: "active",
      reservationId: reservation.id,
      createdAt: now,
      provenance,
    };
  }

  fulfill(commitment: Commitment, now: number): Commitment {
    if (commitment.status !== "active") {
      throw new IllegalStateError(
        `Commitment '${commitment.id}' cannot be fulfilled from status '${commitment.status}'`
      );
    }
    return {
      ...commitment,
      status: "fulfilled",
      fulfilledAt: now,
    };
  }

  release(commitment: Commitment, now: number): Commitment {
    if (commitment.status !== "active") {
      throw new IllegalStateError(
        `Commitment '${commitment.id}' cannot be released from status '${commitment.status}'`
      );
    }
    return {
      ...commitment,
      status: "released",
      releasedAt: now,
    };
  }
}
