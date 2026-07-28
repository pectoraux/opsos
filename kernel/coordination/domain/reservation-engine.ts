/**
 * @kernel/coordination/domain/reservation-engine — the ReservationEngine PORT.
 *
 * A Reservation is a temporary hold on a resource's capacity for a given
 * capability / quantity / window. It is WEAKER than a Commitment: it expires
 * (TTL-bounded) and is released if the demand is re-planned. The reservation
 * engine implements four pure transitions:
 *
 *   create  → Reservation { status: "pending",  expiresAt: now + ttlMs }
 *   confirm → Reservation { status: "confirmed", commitmentId: <new> }
 *   release → Reservation { status: "released",  releasedAt: now }
 *   expire  → Reservation { status: "expired" }
 *
 * `confirm` is the bridge into the CommitmentEngine — the reservation carries
 * the resulting `commitmentId` so the caller can fetch the durable commitment.
 *
 * Determinism rule: `now` is supplied by the caller; the engine NEVER calls
 * `Date.now()`. Reservation ids are produced by an injected `RandomSource` (or
 * by a deterministic id-generator) — NOT by `Math.random()`.
 */

import type {
  ReservationId,
  ResourceId,
  CommitmentId,
  TenantId,
} from "@kernel/shared-kernel";
import type {
  Quantity,
  Reservation,
} from "@kernel/shared-kernel";
import type { TemporalWindow } from "@kernel/shared-kernel";

/**
 * The arguments for `create`. Kept as a positional-style interface so callers
 * building requests imperatively can pass them by name.
 */
export interface ReservationCreateInput {
  readonly resourceId: ResourceId;
  readonly tenantId: TenantId;
  readonly capabilityType: string;
  readonly quantity: Quantity;
  readonly window: TemporalWindow;
  readonly ttlMs: number;
  readonly now: number;
}

/**
 * The ReservationEngine PORT. Every method is a PURE function — it accepts the
 * current `Reservation` (or creation inputs) plus a `now` and returns a NEW
 * `Reservation`. No mutation, no side effects.
 */
export interface ReservationEngine {
  /**
   * Create a fresh `pending` reservation with `expiresAt = now + ttlMs`.
   */
  create(
    resourceId: ResourceId,
    tenantId: TenantId,
    capabilityType: string,
    quantity: Quantity,
    window: TemporalWindow,
    ttlMs: number,
    now: number
  ): Reservation;

  /**
   * Confirm a `pending` reservation → `confirmed`. Returns a reservation whose
   * `commitmentId` is set (the engine mints a new `CommitmentId`; the
   * CommitmentEngine then materialises the commitment from this reservation).
   *
   * Throws `IllegalStateError` (in the in-memory implementation; the port
   * signature is pure data) if the reservation is not `pending` or has
   * expired relative to `now`.
   */
  confirm(reservation: Reservation, now: number): Reservation;

  /** Release a reservation (any non-terminal status) → `released`. */
  release(reservation: Reservation, now: number): Reservation;

  /** Mark a reservation as expired (idempotent if already terminal). */
  expire(reservation: Reservation, now: number): Reservation;
}

/**
 * Internal type re-exported for tests / callers that need to mint ids
 * themselves. The id format is `resv#${resourceId}#${now}#${seq}` in the
 * in-memory engine — but the contract here is just "an opaque branded string".
 */
export type { ReservationId, CommitmentId };
