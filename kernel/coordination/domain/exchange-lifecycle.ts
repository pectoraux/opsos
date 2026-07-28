/**
 * @kernel/coordination/domain/exchange-lifecycle — the deterministic lifecycle
 * of an exchange work-item (Offer → Bid → Match → Reservation → Commitment →
 * Assignment → execution → release).
 *
 * The Coordination Kernel never performs work; it coordinates WHO will perform
 * it. The lifecycle below is the canonical state machine every protocol
 * extension MUST honour: protocols plug policies/strategies into the engines,
 * but they cannot invent transitions outside this table. This is what makes
 * coordination outcomes replayable and auditable.
 *
 * States (FROZEN):
 *   created    — request primitive exists, not yet visible to matchers
 *   published  — visible to matchers / bidders
 *   matched    — at least one Match computed and ranked
 *   reserved   — capacity for the top match is held temporarily
 *   committed  — reservation promoted to a durable Commitment
 *   assigned   — Assignment tendered to a resource
 *   accepted   — resource has accepted the Assignment
 *   executing  — work is in progress
 *   completed  — work finished successfully
 *   released   — all capacity/claims released (terminal success)
 *   cancelled  — abandoned before completion (terminal failure)
 *
 * Determinism rule: this module is PURE data — no `Date.now()`, no I/O, no
 * side effects. `canTransition(from, to)` is a total function.
 */

/**
 * The 11 lifecycle states of an exchange work-item.
 */
export type ExchangeState =
  | "created"
  | "published"
  | "matched"
  | "reserved"
  | "committed"
  | "assigned"
  | "accepted"
  | "executing"
  | "completed"
  | "released"
  | "cancelled";

/**
 * Terminal states — once entered, no further transitions are legal.
 */
export const TERMINAL_EXCHANGE_STATES: readonly ExchangeState[] = [
  "released",
  "cancelled",
];

/**
 * The legal-transition table. Read as: `LEGAL_TRANSITIONS[from]` is the set of
 * states `to` which `from` may legally transition to. Symmetric self-loops are
 * implicitly allowed (a state may always "transition" to itself — a no-op).
 */
export const LEGAL_TRANSITIONS: Readonly<Record<ExchangeState, readonly ExchangeState[]>> = {
  created: ["published", "cancelled"],
  published: ["matched", "cancelled"],
  matched: ["reserved", "published", "cancelled"],
  reserved: ["committed", "released", "matched", "cancelled"],
  committed: ["assigned", "released", "cancelled"],
  assigned: ["accepted", "committed", "cancelled"],
  accepted: ["executing", "assigned", "cancelled"],
  executing: ["completed", "accepted", "cancelled"],
  completed: ["released", "cancelled"],
  released: [],
  cancelled: [],
};

/**
 * Total, deterministic transition guard.
 *
 * Returns `true` iff `from → to` is in the legal-transition table (or `from ===
 * to`, which is treated as a legal no-op). No exceptions, no side effects.
 */
export function canTransition(from: ExchangeState, to: ExchangeState): boolean {
  if (from === to) return true;
  const allowed = LEGAL_TRANSITIONS[from];
  return allowed.includes(to);
}

/**
 * Returns `true` if `state` is terminal (no outgoing transitions).
 */
export function isTerminal(state: ExchangeState): boolean {
  return TERMINAL_EXCHANGE_STATES.includes(state);
}

/**
 * The ordered list of states, useful for diagnostics / rendering.
 */
export const EXCHANGE_STATE_ORDER: readonly ExchangeState[] = [
  "created",
  "published",
  "matched",
  "reserved",
  "committed",
  "assigned",
  "accepted",
  "executing",
  "completed",
  "released",
  "cancelled",
];
