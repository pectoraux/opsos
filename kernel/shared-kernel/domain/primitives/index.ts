/**
 * @kernel/shared-kernel/domain/primitives — barrel.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  CANONICAL LANGUAGE v1 — FROZEN (ADR-0010)                              │
 * │  These names are the CPU instructions of OpsOS. Once frozen they do     │
 * │  NOT change. Additive evolution only (new primitives, new optional      │
 * │  fields); breaking changes require a new API version (v2), never an     │
 * │  in-place mutation of v1.                                               │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * The canonical operational primitives — the ONLY domain concepts the kernel
 * knows. None carries any industry-specific field. Total: 19.
 *
 *   Intent · Demand · Task · ExecutionPlan · Execution · Capability · Resource
 *   Workflow · Policy · Rule · Decision · Event · Projection · Recommendation
 *   Route · Schedule · Simulation · Observation · Twin
 */

// ── Operational / execution-model primitives ────────────────────────────────
export type {
  Intent,
  IntentStatus,
  Demand,
  Task,
  TaskStatus,
  ExecutionPlan,
  PlanStatus,
  Capability,
  Resource,
  Workflow,
  WorkflowStatus,
  Recommendation,
  Simulation,
} from "./operational";

// ── Execution (runtime act + result of running an ExecutionPlan) ────────────
export type {
  Execution,
  ExecutionStatus,
  ExecutionStep,
  ExecutionStepStatus,
} from "./execution";

// ── Governance primitives ───────────────────────────────────────────────────
export type {
  Policy,
  PolicyScope,
  PolicyEffect,
  PolicyStatus,
  Rule,
  RuleEffect,
  Decision,
  DecisionOutcome,
} from "./governance";

// ── Event / read-model primitives ───────────────────────────────────────────
export type {
  Event,
  EventMetadata,
  EventType,
  EventPayload,
} from "./event";

export type { Projection } from "./projection";

// ── Temporal-allocation primitives ──────────────────────────────────────────
export type {
  Schedule,
  ScheduleSlot,
  ScheduleStatus,
  Route,
  RouteStatus,
} from "./schedule";

// ── Feedback / modeling primitives ──────────────────────────────────────────
export type {
  Observation,
  ObservationSource,
  ObservationSubject,
} from "./observation";

export type { Twin } from "./twin";

// ── Coordination primitives (M6 — additive) ─────────────────────────────────
export type {
  Offer,
  OfferStatus,
  Bid,
  BidStatus,
  Claim,
  ClaimStatus,
  Reservation,
  ReservationStatus,
  Commitment,
  CommitmentStatus,
  Assignment,
  AssignmentStatus,
  Agreement,
  AgreementStatus,
  Contract,
  ContractStatus,
  Transfer,
  TransferStatus,
  Delegation,
  DelegationStatus,
  Queue,
  QueueEntry,
  QueueDiscipline,
  Escalation,
  EscalationTrigger,
  EscalationStatus,
  Allocation,
  AllocationStatus,
  Match,
  MatchStatus,
} from "./coordination";

// ── Resource primitives (M7 — additive) ─────────────────────────────────────
export type {
  Location,
  Movement,
  Calendar,
  CalendarEntry,
  CalendarEntryType,
  Certification,
  CertificationStatus,
  ResourceHealth,
  ResourceOperationalState,
  ResourceIssue,
  Maintenance,
  MaintenanceStatus,
  Telemetry,
  ResourceRecord,
} from "./resource";
