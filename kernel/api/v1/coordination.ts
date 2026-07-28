/**
 * @kernel/api/v1 — COORDINATION public surface (FROZEN).
 *
 * The Coordination Kernel: the universal coordination engine that sits between
 * planning and execution. It coordinates WHO will perform work; it never
 * performs work itself. Marketplace is ONE strategy on top, not the kernel
 * (ADR-0015).
 */

// Lifecycle
export type { ExchangeState } from "@kernel/coordination";
export {
  LEGAL_TRANSITIONS,
  TERMINAL_EXCHANGE_STATES,
  EXCHANGE_STATE_ORDER,
  canTransition as canTransitionExchange,
  isTerminal as isTerminalExchange,
} from "@kernel/coordination";

// Events
export type { CoordinationEvent } from "@kernel/coordination";
export { COORDINATION_EVENT_KINDS } from "@kernel/coordination";

// Optimization
export type {
  OptimizationContext,
  OptimizationEvaluator,
  OptimizationRegistry,
} from "@kernel/coordination";
export {
  DEFAULT_OBJECTIVE_NAME,
  constraintCountEvaluator,
} from "@kernel/coordination";

// Engine ports + request/result types
export type {
  MatchingEngine,
  MatchRequest,
  MatchResult,
  MatchPolicy,
  MatchCandidate,
} from "@kernel/coordination";
export { computeMatchId } from "@kernel/coordination";

export type {
  NegotiationEngine,
  NegotiationState,
  NegotiationRound,
  NegotiationRules,
  NegotiationOutcome,
} from "@kernel/coordination";

export type { ReservationEngine } from "@kernel/coordination";
export type { CommitmentEngine } from "@kernel/coordination";

export type {
  AssignmentEngine,
  AssignmentRequest,
} from "@kernel/coordination";

export type {
  QueueEngine,
  QueueEnqueueInput,
  QueueDequeueResult,
  QueueEngineContext,
} from "@kernel/coordination";
export { DEFAULT_QUEUE_WEIGHT } from "@kernel/coordination";

export type { TransferEngine } from "@kernel/coordination";

export type {
  EscalationEngine,
  EscalationPolicy,
  EscalationContext,
} from "@kernel/coordination";

// Protocol extension ports
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
} from "@kernel/coordination";
export { NO_PROTOCOL_EXTENSIONS } from "@kernel/coordination";

// Application
export type {
  CoordinateWork,
  CoordinateWorkInput,
  CoordinateWorkResult,
  CoordinateWorkOutcome,
} from "@kernel/coordination";
export { CoordinateWorkUseCase } from "@kernel/coordination";

// Infrastructure
export {
  InMemoryMatchingEngine,
  InMemoryNegotiationEngine,
  InMemoryReservationEngine,
  InMemoryCommitmentEngine,
  InMemoryAssignmentEngine,
  InMemoryQueueEngine,
  InMemoryTransferEngine,
  InMemoryEscalationEngine,
  createInMemoryCoordinationEngines,
} from "@kernel/coordination";
export type { InMemoryCoordinationEngines } from "@kernel/coordination";
