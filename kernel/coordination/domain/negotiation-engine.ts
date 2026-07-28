/**
 * @kernel/coordination/domain/negotiation-engine — the NegotiationEngine PORT.
 *
 * After an Offer is published, a Bidder and the Offer owner MAY enter a
 * negotiation: a bounded sequence of rounds in which each side proposes terms
 * (a `Bid`) and the other accepts / rejects / counters. The NegotiationEngine
 * holds the deterministic state machine: it tracks rounds, enforces `maxRounds`
 * and `timeoutMs`, and applies optional `autoAcceptPolicy` / `autoRejectPolicy`
 * predicates (serialisable `PredicateSpec`s) to short-circuit rounds.
 *
 * Lifecycle:
 *   open ──accept──► accepted (terminal)
 *   open ──reject──► rejected (terminal)
 *   open ──timeout──► expired (terminal)
 *   open ──counter──► open (round increments, until maxRounds)
 *
 * Determinism rule: every timestamp is supplied via the `now` argument. No
 * `Date.now()`, no `Math.random()`.
 */

import type { OfferId, BidId } from "@kernel/shared-kernel";
import type {
  PredicateSpec,
  UnknownRecord,
  Bid,
} from "@kernel/shared-kernel";

/**
 * The terminal outcome of a negotiation.
 *   - `accepted`  — parties agreed on terms.
 *   - `rejected`  — a party explicitly rejected.
 *   - `countered` — negotiation ended by counter-limit without agreement
 *                   (only set if `maxRounds` exhausted via counters).
 *   - `expired`   — `timeoutMs` elapsed without resolution.
 *   - `timeout`   — `timeout()` invoked (synonym-typed for callers that
 *                   distinguish explicit timeout from natural expiry).
 */
export type NegotiationOutcome =
  | "accepted"
  | "rejected"
  | "countered"
  | "expired"
  | "timeout";

/**
 * A single round of negotiation. The `round` is 1-based. `proposedTerms` is
 * the bid's `proposedTerms` (an opaque `UnknownRecord`). `response` is the
 * engine's classification of that bid given the rules.
 */
export interface NegotiationRound {
  readonly round: number;
  readonly bidId: BidId;
  readonly proposedTerms: UnknownRecord;
  readonly response: NegotiationOutcome;
  readonly respondedAt: number;
}

/**
 * The full state of a negotiation. Pure data — never mutated in place; every
 * engine method returns a NEW `NegotiationState`.
 */
export interface NegotiationState {
  readonly offerId: OfferId;
  readonly rounds: readonly NegotiationRound[];
  readonly status: "open" | "accepted" | "rejected" | "expired";
  readonly startedAt: number;
  readonly endedAt?: number;
  readonly outcome?: NegotiationOutcome;
}

/**
 * Protocol-supplied rules. Pure data — no functions, so the rules can be
 * replayed / audited.
 *
 *   - `maxRounds`       — hard cap on round count; exceeding → `countered`.
 *   - `timeoutMs`       — negotiation auto-expires this long after `startedAt`.
 *   - `autoAcceptPolicy`— if a bid's terms satisfy this predicate, accept.
 *   - `autoRejectPolicy`— if a bid's terms satisfy this predicate, reject.
 */
export interface NegotiationRules {
  readonly maxRounds: number;
  readonly timeoutMs: number;
  readonly autoAcceptPolicy?: PredicateSpec;
  readonly autoRejectPolicy?: PredicateSpec;
}

/**
 * The NegotiationEngine PORT. Every method is a PURE function:
 * `f(state, ...) → newState`. No mutation, no I/O, no wall-clock.
 */
export interface NegotiationEngine {
  /**
   * Begin a negotiation for `offerId` under `rules`. Returns the initial
   * `open` state with `startedAt = now` and zero rounds.
   */
  start(offerId: OfferId, rules: NegotiationRules, now: number): NegotiationState;

  /**
   * Submit a bid against the offer. The engine:
   *   1. If `now - startedAt > timeoutMs`, returns state marked `expired`.
   *   2. Evaluates `autoAcceptPolicy` (if present) against `bid.proposedTerms`.
   *   3. Evaluates `autoRejectPolicy` (if present).
   *   4. If neither short-circuits, records the round as `countered`.
   *   5. If round count exceeds `maxRounds`, marks `expired` (outcome `countered`).
   */
  submitBid(
    state: NegotiationState,
    bid: Bid,
    rules: NegotiationRules,
    now: number
  ): NegotiationState;

  /**
   * Mark the negotiation as timed out (explicit). Outcome = `timeout`.
   */
  timeout(state: NegotiationState, now: number): NegotiationState;
}
