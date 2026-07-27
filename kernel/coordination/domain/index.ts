/**
 * @kernel/coordination/domain — barrel.
 *
 * The domain layer of the Coordination Kernel. Pure types + pure functions.
 * Depends ONLY on `@kernel/shared-kernel`.
 *
 * Public surface:
 *   - Lifecycle:          ExchangeState, LEGAL_TRANSITIONS, canTransition, …
 *   - Events:             CoordinationEvent union + per-kind payload types
 *   - Optimization:       OptimizationEvaluator, OptimizationRegistry, …
 *   - Engines (ports):    MatchingEngine, NegotiationEngine, ReservationEngine,
 *                          CommitmentEngine, AssignmentEngine, QueueEngine,
 *                          TransferEngine, EscalationEngine
 *   - Protocol extensions:the 8 ports protocols register
 */

// ── Lifecycle ───────────────────────────────────────────────────────────────
export type {
  ExchangeState,
} from "./exchange-lifecycle";
export {
  LEGAL_TRANSITIONS,
  TERMINAL_EXCHANGE_STATES,
  EXCHANGE_STATE_ORDER,
  canTransition,
  isTerminal,
} from "./exchange-lifecycle";

// ── Events ──────────────────────────────────────────────────────────────────
export type {
  CoordinationEventBase,
  OfferCreated,
  OfferPublished,
  BidSubmitted,
  MatchComputed,
  MatchSelected,
  ReservationCreated,
  ReservationConfirmed,
  ReservationReleased,
  ReservationExpired,
  CommitmentCreated,
  CommitmentFulfilled,
  CommitmentReleased,
  AssignmentAccepted,
  AssignmentRejected,
  AssignmentCompleted,
  TransferInitiated,
  TransferCompleted,
  QueueEntryEnqueued,
  QueueEntryDequeued,
  EscalationTriggered,
  EscalationAcknowledged,
  EscalationResolved,
  NegotiationStarted,
  NegotiationEnded,
  OptimizationObjectiveEvaluated,
  CoordinationEvent,
} from "./exchange-events";
export {
  COORDINATION_EVENT_KINDS,
} from "./exchange-events";
export type { CoordinationEventKind } from "./exchange-events";

// ── Optimization ────────────────────────────────────────────────────────────
export type {
  OptimizationContext,
  OptimizationEvaluator,
  OptimizationRegistry,
} from "./optimization";
export {
  DEFAULT_OBJECTIVE_NAME,
  constraintCountEvaluator,
} from "./optimization";

// ── Matching engine ─────────────────────────────────────────────────────────
export type {
  MatchRequest,
  MatchResult,
  MatchPolicy,
  MatchingEngine,
  MatchCandidate,
} from "./matching-engine";
export {
  PREFER_BONUS,
  PENALIZE_PENALTY,
  MATCHED_CONSTRAINT_WEIGHT,
  VIOLATED_CONSTRAINT_PENALTY,
  computeMatchId,
} from "./matching-engine";

// ── Negotiation engine ──────────────────────────────────────────────────────
export type {
  NegotiationOutcome,
  NegotiationRound,
  NegotiationState,
  NegotiationRules,
  NegotiationEngine,
} from "./negotiation-engine";

// ── Reservation engine ──────────────────────────────────────────────────────
export type {
  ReservationCreateInput,
  ReservationEngine,
} from "./reservation-engine";

// ── Commitment engine ───────────────────────────────────────────────────────
export type {
  CommitmentEngine,
} from "./commitment-engine";

// ── Assignment engine ───────────────────────────────────────────────────────
export type {
  AssignmentRequest,
  AssignmentEngine,
} from "./assignment-engine";

// ── Queue engine ────────────────────────────────────────────────────────────
export type {
  QueueEnqueueInput,
  QueueEngineContext,
  QueueDequeueResult,
  QueueEngine,
} from "./queue-engine";
export {
  DEFAULT_QUEUE_WEIGHT,
} from "./queue-engine";

// ── Transfer engine ──────────────────────────────────────────────────────────
export type {
  TransferEngine,
} from "./transfer-engine";

// ── Escalation engine ────────────────────────────────────────────────────────
export type {
  EscalationPolicy,
  EscalationContext,
  EscalationEngine,
} from "./escalation-engine";

// ── Protocol extensions ──────────────────────────────────────────────────────
export type {
  MatchingStrategy,
  NegotiationRulesProvider,
  QueuePolicyProvider,
  ReservationPolicyProvider,
  EscalationPolicyProvider,
  OptimizationObjectiveProvider,
  CapabilityRanking,
  AvailabilityModel,
  ProtocolExtensions,
} from "./protocol-extensions";
export {
  NO_PROTOCOL_EXTENSIONS,
} from "./protocol-extensions";
