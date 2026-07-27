/**
 * @kernel/coordination/infrastructure/in-memory-negotiation-engine — the
 * in-memory `NegotiationEngine` implementation.
 *
 * Pure data structures. No `Date.now()`, no `Math.random()`. All time comes
 * from the `now` argument. The engine holds NO state between calls — every
 * method is a pure function of `(state, …) → newState`.
 *
 * Built-in `evaluatePredicate` is the same tiny generic evaluator used by the
 * matching engine (recognises eq, ne, gt, lt, gte, lte, in, and, or, not, attr-eq, attr-ne, attr-gt, attr-lt, capability-has);
 * unknown ops evaluate to `false` for `autoAcceptPolicy` (so unknown
 * auto-accepts never fire) and `true` for `autoRejectPolicy` (so unknown
 * auto-rejects always fire — fail-safe). Protocols that need richer
 * predicates install their own evaluators via the extension system.
 */

import type {
  OfferId,
  BidId,
  PredicateSpec,
  UnknownRecord,
  Bid,
} from "@kernel/shared-kernel";
import type {
  NegotiationState,
  NegotiationRound,
  NegotiationOutcome,
  NegotiationRules,
  NegotiationEngine,
} from "../domain";

export class InMemoryNegotiationEngine implements NegotiationEngine {
  start(offerId: OfferId, _rules: NegotiationRules, now: number): NegotiationState {
    return {
      offerId,
      rounds: [],
      status: "open",
      startedAt: now,
    };
  }

  submitBid(
    state: NegotiationState,
    bid: Bid,
    rules: NegotiationRules,
    now: number
  ): NegotiationState {
    // ── Terminal: no further transitions ────────────────────────────────
    if (state.status !== "open") {
      return state;
    }

    // ── 1. Timeout check ────────────────────────────────────────────────
    if (now - state.startedAt > rules.timeoutMs) {
      return this.terminate(state, "expired", now);
    }

    // ── 2. Auto-accept ──────────────────────────────────────────────────
    if (
      rules.autoAcceptPolicy !== undefined &&
      this.evaluatePredicate(rules.autoAcceptPolicy, bid.proposedTerms)
    ) {
      const round = this.makeRound(state, bid, "accepted", now);
      return {
        ...state,
        rounds: [...state.rounds, round],
        status: "accepted",
        endedAt: now,
        outcome: "accepted",
      };
    }

    // ── 3. Auto-reject ──────────────────────────────────────────────────
    if (
      rules.autoRejectPolicy !== undefined &&
      this.evaluatePredicate(rules.autoRejectPolicy, bid.proposedTerms)
    ) {
      const round = this.makeRound(state, bid, "rejected", now);
      return {
        ...state,
        rounds: [...state.rounds, round],
        status: "rejected",
        endedAt: now,
        outcome: "rejected",
      };
    }

    // ── 4. Counter (default action when no short-circuit) ───────────────
    const nextRoundNumber = state.rounds.length + 1;
    const round = this.makeRound(state, bid, "countered", now);
    const nextState: NegotiationState = {
      ...state,
      rounds: [...state.rounds, round],
    };

    // ── 5. Max-rounds exhausted ─────────────────────────────────────────
    if (nextRoundNumber >= rules.maxRounds) {
      return this.terminate(nextState, "countered", now);
    }
    return nextState;
  }

  timeout(state: NegotiationState, now: number): NegotiationState {
    if (state.status !== "open") return state;
    return this.terminate(state, "timeout", now);
  }

  // ── Internal ───────────────────────────────────────────────────────────
  private makeRound(
    state: NegotiationState,
    bid: Bid,
    response: NegotiationOutcome,
    now: number
  ): NegotiationRound {
    return {
      round: state.rounds.length + 1,
      bidId: bid.id,
      proposedTerms: bid.proposedTerms,
      response,
      respondedAt: now,
    };
  }

  private terminate(
    state: NegotiationState,
    outcome: NegotiationOutcome,
    now: number
  ): NegotiationState {
    const status: NegotiationState["status"] =
      outcome === "accepted"
        ? "accepted"
        : outcome === "rejected" || outcome === "countered"
        ? "rejected"
        : "expired";
    return {
      ...state,
      status,
      endedAt: now,
      outcome,
    };
  }

  /**
   * Built-in predicate evaluator (mirrors the matching engine's). Recognised
   * ops: eq, ne, gt, lt, gte, lte, in, and, or, not, attr-eq, attr-ne, attr-gt, attr-lt, capability-has. Unknown
   * ops evaluate to `false` (fail-safe — used by `autoAcceptPolicy`).
   *
   * The `ctx` for a negotiation is the bid's `proposedTerms` (an
   * `UnknownRecord`); the `attr-*` ops read keys off it.
   */
  private evaluatePredicate(spec: PredicateSpec, ctx: UnknownRecord): boolean {
    const { op, args } = spec;
    switch (op) {
      case "eq":
        return args[0] === args[1];
      case "ne":
        return args[0] !== args[1];
      case "gt":
        return Number(args[0]) > Number(args[1]);
      case "lt":
        return Number(args[0]) < Number(args[1]);
      case "gte":
        return Number(args[0]) >= Number(args[1]);
      case "lte":
        return Number(args[0]) <= Number(args[1]);
      case "in": {
        const list = args[1];
        return Array.isArray(list) && list.includes(args[0]);
      }
      case "and":
        return args.every((s) => this.evaluatePredicate(s as PredicateSpec, ctx));
      case "or":
        return args.some((s) => this.evaluatePredicate(s as PredicateSpec, ctx));
      case "not":
        return !this.evaluatePredicate(args[0] as PredicateSpec, ctx);
      case "attr-eq":
        return ctx[String(args[0] ?? "")] === args[1];
      case "attr-ne":
        return ctx[String(args[0] ?? "")] !== args[1];
      case "attr-gt": {
        const v = ctx[String(args[0] ?? "")];
        return typeof v === "number" && v > Number(args[1] ?? 0);
      }
      case "attr-lt": {
        const v = ctx[String(args[0] ?? "")];
        return typeof v === "number" && v < Number(args[1] ?? 0);
      }
      case "capability-has":
        // Not meaningful against a bid's terms; default false (fail-safe).
        return false;
      default:
        return false;
    }
  }
}

export type { BidId };
