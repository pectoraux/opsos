/**
 * @kernel/shared-kernel/domain/primitives/operational — the execution-model
 * canonical primitives.
 *
 *   Intent → Demand → Task → ExecutionPlan
 *   Capability · Resource · Workflow · Recommendation · Simulation
 *
 * Domain-independent. No industry-specific fields.
 */

import type {
  IntentId,
  DemandId,
  TaskId,
  ExecutionPlanId,
  CapabilityId,
  ResourceId,
  WorkflowId,
  RecommendationId,
  SimulationId,
  PrincipalId,
  TenantId,
} from "../identifiers";
import type {
  Priority,
  Constraint,
  Quantity,
  CapabilityRequirement,
  TaskDependency,
  ExecutionGraphRef,
  ObjectiveFunction,
  AttributeMap,
  Availability,
  Capacity,
  WorkflowStage,
  WorkflowTrigger,
  ProposedAction,
  RecommendationTarget,
  RecommendationSource,
  SimulationInput,
  SimulationOutcome,
  Assumption,
  UnknownPayload,
} from "../value-objects";
import type { TemporalWindow } from "../temporal";
import type { Rule } from "./governance";
import type { Event } from "./event";

// ── 1. Intent ───────────────────────────────────────────────────────────────

export type IntentStatus =
  | "declared"
  | "planning"
  | "planned"
  | "executing"
  | "satisfied"
  | "abandoned";

export interface Intent {
  readonly id: IntentId;
  readonly type: string;
  readonly principalId: PrincipalId;
  readonly tenantId: TenantId;
  readonly payload: UnknownPayload;
  readonly priority: Priority;
  readonly constraints: readonly Constraint[];
  readonly status: IntentStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
}

// ── 2. Demand ───────────────────────────────────────────────────────────────

export interface Demand {
  readonly id: DemandId;
  readonly intentId: IntentId;
  readonly resourceType: string;
  readonly quantity: Quantity;
  readonly constraints: readonly Constraint[];
  readonly temporalWindow: TemporalWindow;
  readonly priority: Priority;
}

// ── 3. Task ─────────────────────────────────────────────────────────────────

export type TaskStatus =
  | "pending"
  | "ready"
  | "assigned"
  | "in-progress"
  | "completed"
  | "failed"
  | "cancelled";

export interface Task {
  readonly id: TaskId;
  readonly intentId: IntentId;
  readonly demandId?: DemandId;
  readonly title: string;
  readonly summary?: string;
  readonly capabilityRequirements: readonly CapabilityRequirement[];
  readonly assignee?: ResourceId;
  readonly scheduleWindow?: TemporalWindow;
  readonly dependencies: readonly TaskDependency[];
  readonly status: TaskStatus;
}

// ── 4. ExecutionPlan ────────────────────────────────────────────────────────

export type PlanStatus =
  | "draft"
  | "proposed"
  | "approved"
  | "executing"
  | "completed"
  | "failed"
  | "superseded";

export interface ExecutionPlan {
  readonly id: ExecutionPlanId;
  readonly intentId: IntentId;
  readonly objective: string;
  readonly tasks: readonly TaskId[];
  readonly graph: ExecutionGraphRef;
  readonly constraints: readonly Constraint[];
  readonly objectiveFunction?: ObjectiveFunction;
  readonly status: PlanStatus;
  readonly version: number;
}

// ── 5. Capability ───────────────────────────────────────────────────────────

export interface Capability {
  readonly id: CapabilityId;
  readonly capabilityType: string;
  readonly providerId: ResourceId;
  readonly parametersSchema: { readonly ref: string; readonly version: number };
  readonly constraints: readonly Constraint[];
}

// ── 6. Resource ─────────────────────────────────────────────────────────────

export interface Resource {
  readonly id: ResourceId;
  readonly resourceType: string;
  readonly capabilities: readonly CapabilityId[];
  readonly attributes: AttributeMap;
  readonly availability: Availability;
  readonly capacity: Capacity;
  readonly tenantId: TenantId;
}

// ── 7. Workflow ─────────────────────────────────────────────────────────────

export type WorkflowStatus = "draft" | "active" | "deprecated";

export interface Workflow {
  readonly id: WorkflowId;
  readonly version: number;
  readonly name: string;
  readonly stages: readonly WorkflowStage[];
  readonly triggers: readonly WorkflowTrigger[];
  readonly guards: readonly Rule[];
  readonly status: WorkflowStatus;
}

// ── 12. Recommendation ──────────────────────────────────────────────────────

export interface Recommendation {
  readonly id: RecommendationId;
  readonly source: RecommendationSource;
  readonly target: RecommendationTarget;
  readonly rationale: string;
  readonly confidence: number;
  readonly proposedAction: ProposedAction;
  readonly createdAt: number;
}

// ── 16. Simulation ──────────────────────────────────────────────────────────

export interface Simulation {
  readonly id: SimulationId;
  readonly scenario: string;
  readonly inputs: readonly SimulationInput[];
  readonly assumedState: Readonly<Record<string, unknown>>;
  readonly projectedEvents: readonly Event[];
  readonly outcomes: readonly SimulationOutcome[];
  readonly assumptions: readonly Assumption[];
  readonly ranAt: number;
  readonly seed: number;
}
