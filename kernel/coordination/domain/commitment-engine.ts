/**
 * @kernel/coordination/domain/commitment-engine — the CommitmentEngine PORT.
 *
 * A Commitment is the durable counterpart of a Reservation: it survives
 * re-planning, is the precondition for an Assignment, and can only be released
 * (not silently dropped). The CommitmentEngine has three transitions:
 *
 *   create   → Commitment { status: "active", reservationId?: <src> }
 *   fulfill  → Commitment { status: "fulfilled" }
 *   release  → Commitment { status: "released" }
 *
 * `create` consumes a confirmed `Reservation` and mints a `Commitment` whose
 * `reservationId` is set (so the lineage is auditable). `fulfill` is invoked
 * when the work the commitment backs completes; `release` is invoked when the
 * commitment is no longer needed (e.g. the demand was cancelled downstream).
 *
 * Determinism rule: `now` is supplied by the caller; ids come from an injected
 * `RandomSource`. No `Date.now()`, no `Math.random()`.
 */

import type {
  CommitmentId,
} from "@kernel/shared-kernel";
import type {
  Commitment,
  Reservation,
  ProvenanceRef,
} from "@kernel/shared-kernel";

/**
 * The CommitmentEngine PORT. Every method is PURE: returns a NEW `Commitment`
 * derived from the inputs.
 */
export interface CommitmentEngine {
  /**
   * Materialise a `Commitment` from a confirmed `Reservation`. The
   * reservation's `commitmentId` (set by `ReservationEngine.confirm`) becomes
   * the commitment's `id`. Carries `provenance` for audit.
   *
   * Precondition: `reservation.status === "confirmed"` AND
   * `reservation.commitmentId` is set.
   */
  create(
    reservation: Reservation,
    provenance: ProvenanceRef,
    now: number
  ): Commitment;

  /** Mark an active commitment as `fulfilled`. */
  fulfill(commitment: Commitment, now: number): Commitment;

  /** Mark an active commitment as `released`. */
  release(commitment: Commitment, now: number): Commitment;
}

export type { CommitmentId };
