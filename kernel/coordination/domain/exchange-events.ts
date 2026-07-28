/**
 * @kernel/coordination/domain/exchange-events — event payload types emitted by
 * the coordination engines.
 *
 * These are *payload shapes* only (pure data, no behaviour, no `Date`). The
 * actual `Event<T>` envelope lives in `@kernel/shared-kernel`; the coordination
 * module produces typed payloads that an event store / projection layer can
 * subscribe to. Every timestamp is a clock-sourced epoch-millis supplied by the
 * caller via the `now` argument — never `Date.now()`.
 *
 * The events are partitioned by their emitting engine:
 *   - Offer/Bid           (matching + negotiation)
 *   - Reservation          (reservation engine)
 *   - Commitment           (commitment engine)
 *   - Assignment / Transfer (assignment + transfer engines)
 *   - Queue                (queue engine)
 *   - Escalation           (escalation engine)
 *   - Negotiation          (negotiation engine)
 *   - Match                (matching engine)
 *
 * Every event carries the originating `tenantId` and a `correlationId` so
 * downstream projections can rebuild the full coordination trace.
 */

import type {
  DemandId,
  ResourceId,
  CapabilityId,
  TenantId,
  OfferId,
  BidId,
  ReservationId,
  CommitmentId,
  AssignmentId,
  TransferId,
  QueueId,
  EscalationId,
  MatchId,
  PrincipalId,
} from "@kernel/shared-kernel";
import type {
  Constraint,
  Priority,
  Quantity,
  UnknownRecord,
  ObjectiveFunction,
} from "@kernel/shared-kernel";
import type { TemporalWindow } from "@kernel/shared-kernel";

// ── Common envelope ────────────────────────────────────────────────────────

/**
 * The shared envelope every coordination event payload carries. The concrete
 * payload types below EXTEND this with their own `kind` discriminator.
 */
export interface CoordinationEventBase {
  readonly tenantId: TenantId;
  readonly correlationId: string;
  /** Clock-sourced epoch-millis — supplied by the caller. */
  readonly occurredAt: number;
}

// ── Offer / Bid ────────────────────────────────────────────────────────────

export interface OfferCreated extends CoordinationEventBase {
  readonly kind: "offer.created";
  readonly offerId: OfferId;
  readonly demandId: DemandId;
  readonly capabilityType: string;
  readonly quantity: Quantity;
  readonly window: TemporalWindow;
  readonly priority: Priority;
}

export interface OfferPublished extends CoordinationEventBase {
  readonly kind: "offer.published";
  readonly offerId: OfferId;
  readonly publishedAt: number;
  readonly expiresAt?: number;
}

export interface BidSubmitted extends CoordinationEventBase {
  readonly kind: "bid.submitted";
  readonly bidId: BidId;
  readonly offerId: OfferId;
  readonly resourceId: ResourceId;
  readonly proposedTerms: UnknownRecord;
}

// ── Match ──────────────────────────────────────────────────────────────────

export interface MatchComputed extends CoordinationEventBase {
  readonly kind: "match.computed";
  readonly matchId: MatchId;
  readonly demandId: DemandId;
  readonly resourceId: ResourceId;
  readonly capabilityId: CapabilityId;
  readonly score: number;
  readonly rank: number;
  readonly matchedConstraints: readonly Constraint[];
  readonly violatedConstraints: readonly Constraint[];
}

export interface MatchSelected extends CoordinationEventBase {
  readonly kind: "match.selected";
  readonly matchId: MatchId;
  readonly demandId: DemandId;
  readonly resourceId: ResourceId;
}

// ── Reservation ────────────────────────────────────────────────────────────

export interface ReservationCreated extends CoordinationEventBase {
  readonly kind: "reservation.created";
  readonly reservationId: ReservationId;
  readonly resourceId: ResourceId;
  readonly capabilityType: string;
  readonly quantity: Quantity;
  readonly window: TemporalWindow;
  readonly expiresAt: number;
}

export interface ReservationConfirmed extends CoordinationEventBase {
  readonly kind: "reservation.confirmed";
  readonly reservationId: ReservationId;
  readonly commitmentId: CommitmentId;
  readonly confirmedAt: number;
}

export interface ReservationReleased extends CoordinationEventBase {
  readonly kind: "reservation.released";
  readonly reservationId: ReservationId;
  readonly releasedAt: number;
}

export interface ReservationExpired extends CoordinationEventBase {
  readonly kind: "reservation.expired";
  readonly reservationId: ReservationId;
  readonly expiredAt: number;
}

// ── Commitment ─────────────────────────────────────────────────────────────

export interface CommitmentCreated extends CoordinationEventBase {
  readonly kind: "commitment.created";
  readonly commitmentId: CommitmentId;
  readonly reservationId?: ReservationId;
  readonly resourceId: ResourceId;
  readonly capabilityType: string;
  readonly quantity: Quantity;
  readonly window: TemporalWindow;
}

export interface CommitmentFulfilled extends CoordinationEventBase {
  readonly kind: "commitment.fulfilled";
  readonly commitmentId: CommitmentId;
  readonly fulfilledAt: number;
}

export interface CommitmentReleased extends CoordinationEventBase {
  readonly kind: "commitment.released";
  readonly commitmentId: CommitmentId;
  readonly releasedAt: number;
}

// ── Assignment ─────────────────────────────────────────────────────────────

export interface AssignmentAccepted extends CoordinationEventBase {
  readonly kind: "assignment.accepted";
  readonly assignmentId: AssignmentId;
  readonly resourceId: ResourceId;
  readonly acceptedAt: number;
}

export interface AssignmentRejected extends CoordinationEventBase {
  readonly kind: "assignment.rejected";
  readonly assignmentId: AssignmentId;
  readonly resourceId: ResourceId;
  readonly reason: string;
  readonly rejectedAt: number;
}

export interface AssignmentCompleted extends CoordinationEventBase {
  readonly kind: "assignment.completed";
  readonly assignmentId: AssignmentId;
  readonly completedAt: number;
}

// ── Transfer ───────────────────────────────────────────────────────────────

export interface TransferInitiated extends CoordinationEventBase {
  readonly kind: "transfer.initiated";
  readonly transferId: TransferId;
  readonly assignmentId: AssignmentId;
  readonly fromResourceId: ResourceId;
  readonly toResourceId: ResourceId;
  readonly reason: string;
}

export interface TransferCompleted extends CoordinationEventBase {
  readonly kind: "transfer.completed";
  readonly transferId: TransferId;
  readonly assignmentId: AssignmentId;
  readonly completedAt: number;
}

// ── Queue ──────────────────────────────────────────────────────────────────

export interface QueueEntryEnqueued extends CoordinationEventBase {
  readonly kind: "queue.entry.enqueued";
  readonly queueId: QueueId;
  readonly entryId: string;
  readonly itemRef: string;
  readonly priority: Priority;
}

export interface QueueEntryDequeued extends CoordinationEventBase {
  readonly kind: "queue.entry.dequeued";
  readonly queueId: QueueId;
  readonly entryId: string;
  readonly itemRef: string;
  readonly dequeuedAt: number;
}

// ── Escalation ─────────────────────────────────────────────────────────────

export interface EscalationTriggered extends CoordinationEventBase {
  readonly kind: "escalation.triggered";
  readonly escalationId: EscalationId;
  readonly subjectType: "assignment" | "offer" | "reservation" | "commitment" | "queue";
  readonly subjectId: string;
  readonly trigger: "timeout" | "failure" | "capacity-shortage" | "policy-violation" | "manual";
  readonly severity: Priority;
  readonly target: ResourceId | PrincipalId;
  readonly reason: string;
}

export interface EscalationAcknowledged extends CoordinationEventBase {
  readonly kind: "escalation.acknowledged";
  readonly escalationId: EscalationId;
  readonly acknowledgedAt: number;
}

export interface EscalationResolved extends CoordinationEventBase {
  readonly kind: "escalation.resolved";
  readonly escalationId: EscalationId;
  readonly resolvedAt: number;
}

// ── Negotiation ────────────────────────────────────────────────────────────

export interface NegotiationStarted extends CoordinationEventBase {
  readonly kind: "negotiation.started";
  readonly offerId: OfferId;
  readonly startedAt: number;
  readonly maxRounds: number;
  readonly timeoutMs: number;
}

export interface NegotiationEnded extends CoordinationEventBase {
  readonly kind: "negotiation.ended";
  readonly offerId: OfferId;
  readonly outcome: "accepted" | "rejected" | "countered" | "expired" | "timeout";
  readonly endedAt: number;
}

// ── Optimization ───────────────────────────────────────────────────────────

export interface OptimizationObjectiveEvaluated extends CoordinationEventBase {
  readonly kind: "optimization.evaluated";
  readonly objective: ObjectiveFunction;
  readonly demandId: DemandId;
  readonly score: number;
}

// ── Discriminated union ────────────────────────────────────────────────────

/**
 * The union of all coordination event payloads. The `kind` discriminator
 * drives exhaustive switch-handling in projection / projection-subscriber
 * code.
 */
export type CoordinationEvent =
  | OfferCreated
  | OfferPublished
  | BidSubmitted
  | MatchComputed
  | MatchSelected
  | ReservationCreated
  | ReservationConfirmed
  | ReservationReleased
  | ReservationExpired
  | CommitmentCreated
  | CommitmentFulfilled
  | CommitmentReleased
  | AssignmentAccepted
  | AssignmentRejected
  | AssignmentCompleted
  | TransferInitiated
  | TransferCompleted
  | QueueEntryEnqueued
  | QueueEntryDequeued
  | EscalationTriggered
  | EscalationAcknowledged
  | EscalationResolved
  | NegotiationStarted
  | NegotiationEnded
  | OptimizationObjectiveEvaluated;

/**
 * String literal set of every event `kind`. Useful for schemas / validators.
 */
export const COORDINATION_EVENT_KINDS = [
  "offer.created",
  "offer.published",
  "bid.submitted",
  "match.computed",
  "match.selected",
  "reservation.created",
  "reservation.confirmed",
  "reservation.released",
  "reservation.expired",
  "commitment.created",
  "commitment.fulfilled",
  "commitment.released",
  "assignment.accepted",
  "assignment.rejected",
  "assignment.completed",
  "transfer.initiated",
  "transfer.completed",
  "queue.entry.enqueued",
  "queue.entry.dequeued",
  "escalation.triggered",
  "escalation.acknowledged",
  "escalation.resolved",
  "negotiation.started",
  "negotiation.ended",
  "optimization.evaluated",
] as const;

export type CoordinationEventKind = typeof COORDINATION_EVENT_KINDS[number];
