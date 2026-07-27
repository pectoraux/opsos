/**
 * @kernel/coordination/infrastructure/in-memory-reservation-engine — the
 * in-memory `ReservationEngine` implementation.
 *
 * Pure data structures + a per-instance counter for id minting. No
 * `Date.now()`, no `Math.random()`. All time comes from the `now` argument.
 *
 * Transition table:
 *   create   → { status: "pending",   expiresAt: now + ttlMs }
 *   confirm  → { status: "confirmed", commitmentId: <new> }    (precondition: pending + not expired)
 *   release  → { status: "released",  releasedAt: now }        (precondition: non-terminal)
 *   expire   → { status: "expired" }                            (idempotent on terminal)
 *
 * `confirm` mints a new `CommitmentId` and stamps it onto the reservation;
 * the caller then hands the reservation to `CommitmentEngine.create` which
 * materialises the commitment carrying that id.
 */

import { asId, IllegalStateError } from "@kernel/shared-kernel";
import type {
  ReservationId,
  ResourceId,
  CommitmentId,
  TenantId,
  Quantity,
  Reservation,
} from "@kernel/shared-kernel";
import type { TemporalWindow } from "@kernel/shared-kernel";
import type { ReservationEngine } from "../domain";

export class InMemoryReservationEngine implements ReservationEngine {
  private counter = 0;

  create(
    resourceId: ResourceId,
    tenantId: TenantId,
    capabilityType: string,
    quantity: Quantity,
    window: TemporalWindow,
    ttlMs: number,
    now: number
  ): Reservation {
    const id = this.mintReservationId(resourceId, now);
    return {
      id,
      resourceId,
      tenantId,
      capabilityType,
      quantity,
      window,
      status: "pending",
      createdAt: now,
      expiresAt: now + ttlMs,
    };
  }

  confirm(reservation: Reservation, now: number): Reservation {
    if (reservation.status !== "pending") {
      throw new IllegalStateError(
        `Reservation '${reservation.id}' cannot be confirmed from status '${reservation.status}'`
      );
    }
    if (now > reservation.expiresAt) {
      throw new IllegalStateError(
        `Reservation '${reservation.id}' expired at ${reservation.expiresAt}; now=${now}`
      );
    }
    const commitmentId = this.mintCommitmentId(reservation.id, now);
    return {
      ...reservation,
      status: "confirmed",
      commitmentId,
    };
  }

  release(reservation: Reservation, now: number): Reservation {
    if (reservation.status === "released" || reservation.status === "expired") {
      return reservation; // idempotent on terminal
    }
    return {
      ...reservation,
      status: "released",
      releasedAt: now,
    };
  }

  expire(reservation: Reservation, _now: number): Reservation {
    if (reservation.status === "released" || reservation.status === "expired") {
      return reservation; // idempotent on terminal
    }
    return {
      ...reservation,
      status: "expired",
    };
  }

  // ── Internal: id minting ────────────────────────────────────────────────
  private mintReservationId(resourceId: ResourceId, now: number): ReservationId {
    this.counter += 1;
    return asId<"ReservationId">(
      `resv#${resourceId}#${now}#${this.counter}`
    );
  }

  private mintCommitmentId(
    reservationId: ReservationId,
    now: number
  ): CommitmentId {
    this.counter += 1;
    return asId<"CommitmentId">(
      `cmmt#${reservationId}#${now}#${this.counter}`
    );
  }
}
