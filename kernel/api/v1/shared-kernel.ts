/**
 * @kernel/api/v1 — SHARED-KERNEL public surface (FROZEN).
 *
 * The bedrock: branded identifiers, Result/Option, the kernel error hierarchy,
 * shared value objects, the RuntimeClock/RandomSource PORTS, and the 19
 * canonical operational primitives (the frozen canonical language, ADR-0010).
 *
 * This is the single source of truth for the canonical vocabulary. Every other
 * v1 sub-module builds on these types.
 */

// ── Branded identifiers (the canonical language's nouns) ────────────────────
export type {
  Brand,
  IntentId,
  DemandId,
  TaskId,
  ExecutionPlanId,
  CapabilityId,
  ResourceId,
  WorkflowId,
  PolicyId,
  RuleId,
  ProjectionId,
  RecommendationId,
  RouteId,
  ScheduleId,
  ScheduleSlotId,
  DecisionId,
  SimulationId,
  ExecutionId,
  ObservationId,
  TwinId,
  // Coordination (M6)
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
  UserId,
  PrincipalId,
  RoleId,
  PermissionId,
  OrganizationId,
  TenantId,
  AggregateId,
  StreamId,
  EventId,
  TypedId,
} from "@kernel/shared-kernel";

export { asId, aggregateStreamId } from "@kernel/shared-kernel";

// ── Result / Option (total functions, no exceptions in the core) ────────────
export type { Result, Option } from "@kernel/shared-kernel";
export {
  ok,
  err,
  isOk,
  isErr,
  mapResult,
  flatMapResult,
  some,
  none,
  isSome,
  isNone,
  unwrapOr,
} from "@kernel/shared-kernel";

// ── Kernel error hierarchy ──────────────────────────────────────────────────
export {
  KernelError,
  ConcurrencyConflictError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  DeterminismViolationError,
  IllegalStateError,
  LimitExceededError,
} from "@kernel/shared-kernel";

// ── Versioning & time ───────────────────────────────────────────────────────
export type { Version, ClockTime, LogicalTick, Versioned } from "@kernel/shared-kernel";
export {
  NO_VERSION,
  EMPTY_STREAM,
  ANY_VERSION,
  compareVersion,
  nextVersion,
} from "@kernel/shared-kernel";

// ── Temporal & shared value objects ─────────────────────────────────────────
export type {
  TemporalWindow,
  ScheduleWindow,
  RecurrenceRule,
  Priority,
  Quantity,
  Constraint,
  Availability,
  Capacity,
  PredicateSpec,
  SchemaRef,
  ProvenanceRef,
  ObjectiveFunction,
  TaskDependency,
  CapabilityRequirement,
  WorkflowStage,
  WorkflowTrigger,
  DecisionInput,
  DecisionSubject,
  SimulationInput,
  SimulationOutcome,
  Assumption,
  ProposedAction,
  RecommendationTarget,
  RecommendationSource,
  TransformSpec,
  ExecutionGraphRef,
  UnknownRecord,
  UnknownPayload,
  UnknownState,
  AttributeMap,
} from "@kernel/shared-kernel";

// ── RuntimeClock & RandomSource PORTS ───────────────────────────────────────
export type { RuntimeClock, RandomSource } from "@kernel/shared-kernel";
export { FixedClock, mulberry32, hashSeed } from "@kernel/shared-kernel";

// ── The 19 canonical primitives (FROZEN canonical language, ADR-0010) ───────
export type {
  Intent,
  IntentStatus,
  Demand,
  Task,
  TaskStatus,
  ExecutionPlan,
  PlanStatus,
  Execution,
  ExecutionStatus,
  ExecutionStep,
  ExecutionStepStatus,
  Capability,
  Resource,
  Workflow,
  WorkflowStatus,
  Recommendation,
  Simulation,
  Policy,
  PolicyScope,
  PolicyEffect,
  PolicyStatus,
  Rule,
  RuleEffect,
  Decision,
  DecisionOutcome,
  Event,
  EventMetadata,
  EventType,
  EventPayload,
  Projection,
  Schedule,
  ScheduleSlot,
  ScheduleStatus,
  Route,
  RouteStatus,
  Observation,
  ObservationSource,
  ObservationSubject,
  Twin,
  // Coordination (M6 — additive)
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
} from "@kernel/shared-kernel";
