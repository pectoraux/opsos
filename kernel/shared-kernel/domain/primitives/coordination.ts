/**
 * @kernel/shared-kernel/domain/primitives/coordination — the 14 coordination
 * canonical primitives introduced in M6.
 *
 *   Offer · Bid · Claim · Reservation · Commitment · Assignment · Agreement
 *   · Contract · Transfer · Delegation · Queue · Escalation · Allocation · Match
 *
 * Domain-independent. No industry-specific fields. These are the universal
 * nouns the Coordination Kernel orchestrates.
 */

import type {
  OfferId,
  BidId,
  ClaimId,
  ReservationId,
  CommitmentId,
  AssignmentId,
  AgreementId,
  ContractId,
  TransferId,
  DelegationId,
  QueueId,
  EscalationId,
  AllocationId,
  MatchId,
  IntentId,
  DemandId,
  TaskId,
  ExecutionPlanId,
  CapabilityId,
  ResourceId,
  PrincipalId,
  TenantId,
} from "../identifiers";
import type {
  Priority,
  Constraint,
  Quantity,
  PredicateSpec,
  UnknownRecord,
  ProvenanceRef,
} from "../value-objects";
import type { TemporalWindow } from "../temporal";

// ── 1. Offer ────────────────────────────────────────────────────────────────

export type OfferStatus =
  | "draft"
  | "published"
  | "matched"
  | "expired"
  | "withdrawn"
  | "cancelled";

/** An offer of work or capability, published to the exchange. */
export interface Offer {
  readonly id: OfferId;
  readonly demandId: DemandId;
  readonly intentId: IntentId;
  readonly tenantId: TenantId;
  readonly capabilityType: string;
  readonly quantity: Quantity;
  readonly window: TemporalWindow;
  readonly priority: Priority;
  readonly constraints: readonly Constraint[];
  readonly status: OfferStatus;
  readonly publishedAt?: number;
  readonly expiresAt?: number;
}

// ── 2. Bid ──────────────────────────────────────────────────────────────────

export type BidStatus =
  | "submitted"
  | "countered"
  | "accepted"
  | "rejected"
  | "expired"
  | "withdrawn";

/** A bid submitted against an offer by a resource or agent. */
export interface Bid {
  readonly id: BidId;
  readonly offerId: OfferId;
  readonly resourceId: ResourceId;
  readonly tenantId: TenantId;
  readonly proposedTerms: UnknownRecord;
  readonly priority: Priority;
  readonly constraints: readonly Constraint[];
  readonly status: BidStatus;
  readonly submittedAt: number;
  readonly expiresAt?: number;
}

// ── 3. Claim ────────────────────────────────────────────────────────────────

export type ClaimStatus = "active" | "released" | "contested" | "expired";

/** A claim of ownership/rights over work, a resource slot, or an outcome. */
export interface Claim {
  readonly id: ClaimId;
  readonly subjectType: "task" | "resource-slot" | "outcome";
  readonly subjectId: string;
  readonly claimantId: ResourceId | PrincipalId;
  readonly tenantId: TenantId;
  readonly status: ClaimStatus;
  readonly claimedAt: number;
  readonly expiresAt?: number;
  readonly provenance: ProvenanceRef;
}

// ── 4. Reservation ──────────────────────────────────────────────────────────

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "released"
  | "expired"
  | "converted";

/**
 * A temporary reservation of a resource's capacity. Weaker than a commitment.
 * Expirable. May be confirmed (→ commitment) or released.
 */
export interface Reservation {
  readonly id: ReservationId;
  readonly resourceId: ResourceId;
  readonly tenantId: TenantId;
  readonly capabilityType: string;
  readonly quantity: Quantity;
  readonly window: TemporalWindow;
  readonly status: ReservationStatus;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly releasedAt?: number;
  readonly commitmentId?: CommitmentId;
}

// ── 5. Commitment ───────────────────────────────────────────────────────────

export type CommitmentStatus =
  | "active"
  | "fulfilled"
  | "released"
  | "breached";

/**
 * A commitment. Stronger than a reservation — survives replanning. Protocols
 * cannot bypass commitments.
 */
export interface Commitment {
  readonly id: CommitmentId;
  readonly resourceId: ResourceId;
  readonly tenantId: TenantId;
  readonly capabilityType: string;
  readonly quantity: Quantity;
  readonly window: TemporalWindow;
  readonly status: CommitmentStatus;
  readonly reservationId?: ReservationId;
  readonly createdAt: number;
  readonly fulfilledAt?: number;
  readonly releasedAt?: number;
  readonly provenance: ProvenanceRef;
}

// ── 6. Assignment ───────────────────────────────────────────────────────────

export type AssignmentStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "reassigned"
  | "cancelled"
  | "completed";

/** Connects an execution plan / task / capability / commitment to a resource. */
export interface Assignment {
  readonly id: AssignmentId;
  readonly taskId: TaskId;
  readonly executionPlanId?: ExecutionPlanId;
  readonly resourceId: ResourceId;
  readonly capabilityId: CapabilityId;
  readonly commitmentId?: CommitmentId;
  readonly tenantId: TenantId;
  readonly status: AssignmentStatus;
  readonly assignedAt: number;
  readonly acceptedAt?: number;
  readonly completedAt?: number;
  readonly provenance: ProvenanceRef;
}

// ── 7. Agreement ────────────────────────────────────────────────────────────

export type AgreementStatus =
  | "proposed"
  | "negotiating"
  | "agreed"
  | "active"
  | "terminated"
  | "breached";

/** A multi-party agreement governing work terms (negotiated or direct). */
export interface Agreement {
  readonly id: AgreementId;
  readonly parties: readonly (ResourceId | PrincipalId)[];
  readonly tenantId: TenantId;
  readonly terms: UnknownRecord;
  readonly status: AgreementStatus;
  readonly createdAt: number;
  readonly agreedAt?: number;
  readonly terminatedAt?: number;
}

// ── 8. Contract ─────────────────────────────────────────────────────────────

export type ContractStatus =
  | "draft"
  | "signed"
  | "active"
  | "completed"
  | "voided";

/** A formalized, persistent contract (longer-lived than an agreement). */
export interface Contract {
  readonly id: ContractId;
  readonly agreementId?: AgreementId;
  readonly parties: readonly (ResourceId | PrincipalId)[];
  readonly tenantId: TenantId;
  readonly terms: UnknownRecord;
  readonly status: ContractStatus;
  readonly createdAt: number;
  readonly signedAt?: number;
  readonly completedAt?: number;
}

// ── 9. Transfer ─────────────────────────────────────────────────────────────

export type TransferStatus = "initiated" | "accepted" | "completed" | "rejected";

/** A transfer of work/assignment from one resource to another. Full provenance. */
export interface Transfer {
  readonly id: TransferId;
  readonly assignmentId: AssignmentId;
  readonly fromResourceId: ResourceId;
  readonly toResourceId: ResourceId;
  readonly tenantId: TenantId;
  readonly reason: string;
  readonly status: TransferStatus;
  readonly initiatedAt: number;
  readonly completedAt?: number;
  readonly provenance: ProvenanceRef;
}

// ── 10. Delegation ──────────────────────────────────────────────────────────

export type DelegationStatus = "active" | "revoked" | "expired";

/** A delegation of authority from one principal/resource to another. */
export interface Delegation {
  readonly id: DelegationId;
  readonly delegator: ResourceId | PrincipalId;
  readonly delegate: ResourceId | PrincipalId;
  readonly tenantId: TenantId;
  readonly scope: string;
  readonly constraints: readonly Constraint[];
  readonly status: DelegationStatus;
  readonly grantedAt: number;
  readonly expiresAt?: number;
  readonly revokedAt?: number;
}

// ── 11. Queue ───────────────────────────────────────────────────────────────

export type QueueDiscipline = "fifo" | "priority" | "weighted" | "deadline";

export interface QueueEntry {
  readonly id: string;
  readonly itemRef: string;
  readonly priority: Priority;
  readonly weight?: number;
  readonly deadline?: number;
  readonly enqueuedAt: number;
}

/** A work queue with a configurable discipline. */
export interface Queue {
  readonly id: QueueId;
  readonly tenantId: TenantId;
  readonly name: string;
  readonly discipline: QueueDiscipline;
  readonly entries: readonly QueueEntry[];
  readonly createdAt: number;
}

// ── 12. Escalation ──────────────────────────────────────────────────────────

export type EscalationTrigger =
  | "timeout"
  | "failure"
  | "capacity-shortage"
  | "policy-violation"
  | "manual";

export type EscalationStatus =
  | "triggered"
  | "acknowledged"
  | "resolved"
  | "ignored";

/** An automatic escalation triggered by a policy condition. */
export interface Escalation {
  readonly id: EscalationId;
  readonly subjectType: "assignment" | "offer" | "reservation" | "commitment" | "queue";
  readonly subjectId: string;
  readonly tenantId: TenantId;
  readonly trigger: EscalationTrigger;
  readonly severity: Priority;
  readonly status: EscalationStatus;
  readonly triggeredAt: number;
  readonly resolvedAt?: number;
  readonly target: ResourceId | PrincipalId;
  readonly reason: string;
  readonly provenance: ProvenanceRef;
}

// ── 13. Allocation ──────────────────────────────────────────────────────────

export type AllocationStatus = "proposed" | "confirmed" | "released";

/** An allocation of resources to demands (the output of the matching engine). */
export interface Allocation {
  readonly id: AllocationId;
  readonly tenantId: TenantId;
  readonly demandIds: readonly DemandId[];
  readonly resourceIds: readonly ResourceId[];
  readonly matchId?: MatchId;
  readonly objectiveFunction: string;
  readonly score: number;
  readonly status: AllocationStatus;
  readonly createdAt: number;
  readonly confirmedAt?: number;
}

// ── 14. Match ───────────────────────────────────────────────────────────────

export type MatchStatus = "candidate" | "selected" | "rejected" | "expired";

/** A single demand→resource match produced by the matching engine. */
export interface Match {
  readonly id: MatchId;
  readonly demandId: DemandId;
  readonly resourceId: ResourceId;
  readonly capabilityId: CapabilityId;
  readonly tenantId: TenantId;
  readonly score: number;
  readonly rank: number;
  readonly matchedConstraints: readonly Constraint[];
  readonly violatedConstraints: readonly Constraint[];
  readonly status: MatchStatus;
  readonly computedAt: number;
  readonly provenance: ProvenanceRef;
}
