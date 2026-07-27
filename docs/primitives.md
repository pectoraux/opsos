# OpsOS — Canonical Operational Primitives

> The **only** domain concepts the kernel knows. Every primitive is
> **domain-independent**. None carries any industry-specific field.
> Cleaning, delivery, healthcare, etc. are expressed later by composing these
> primitives inside protocols — never by extending the kernel.

All primitives live in `@kernel/shared-kernel/domain/primitives/`. They are
abstract canonical *types* (interfaces + branded IDs). Concrete realizations
are owned by the module listed in [`architecture.md §4`](./architecture.md).

---

## Identifier Conventions

Every entity has a branded string ID (`IntentId`, `TaskId`, …) defined in
`@kernel/shared-kernel/domain/identifiers.ts`. Branding prevents accidental
cross-assignment (a `TaskId` cannot be passed where a `ResourceId` is expected).

```ts
type Brand<T, B> = T & { readonly __brand: B };
export type IntentId = Brand<string, "IntentId">;
// … one per primitive
```

---

## 1. Intent
A declared operational goal. "I want X achieved" — without specifying how.

```ts
interface Intent {
  id: IntentId;
  type: string;                 // protocol-defined, validated by registry
  principalId: PrincipalId;
  tenantId: TenantId;
  payload: UnknownPayload;
  priority: Priority;
  constraints: Constraint[];
  status: IntentStatus;
  createdAt: number;            // epoch ms from RuntimeClock
  updatedAt: number;
}
```

## 2. Demand
A quantified requirement derived from an intent.

```ts
interface Demand {
  id: DemandId;
  intentId: IntentId;
  resourceType: ResourceType;
  quantity: Quantity;
  constraints: Constraint[];
  temporalWindow: TemporalWindow;
  priority: Priority;
}
```

## 3. Task
A discrete unit of operational work satisfying a demand.

```ts
interface Task {
  id: TaskId;
  intentId: IntentId;
  demandId?: DemandId;
  title: string;
  summary?: string;
  capabilityRequirements: CapabilityRequirement[];
  assignee?: ResourceId;
  scheduleWindow?: TemporalWindow;
  dependencies: TaskDependency[];
  status: TaskStatus;
}
```

## 4. ExecutionPlan
An ordered graph of tasks satisfying an intent.

```ts
interface ExecutionPlan {
  id: ExecutionPlanId;
  intentId: IntentId;
  objective: string;
  tasks: TaskId[];
  graph: ExecutionGraphRef;
  constraints: Constraint[];
  objectiveFunction?: ObjectiveFunction;
  status: PlanStatus;
  version: number;
}
```

## 5. Capability
An ability offered by a resource or actor.

```ts
interface Capability {
  id: CapabilityId;
  capabilityType: string;
  providerId: ResourceId;
  parametersSchema: SchemaRef;
  constraints: Constraint[];
}
```

## 6. Resource
Any allocatable asset (human, machine, location, material).

```ts
interface Resource {
  id: ResourceId;
  resourceType: ResourceType;
  capabilities: CapabilityId[];
  attributes: AttributeMap;
  availability: Availability;
  capacity: Capacity;
  tenantId: TenantId;
}
```

## 7. Workflow
A named, versioned sequence of stages.

```ts
interface Workflow {
  id: WorkflowId;
  version: number;
  name: string;
  stages: WorkflowStage[];
  triggers: WorkflowTrigger[];
  guards: Rule[];
  status: WorkflowStatus;
}
```

## 8. Policy
A named bundle of rules governing decisions.

```ts
interface Policy {
  id: PolicyId;
  version: number;
  name: string;
  scope: PolicyScope;
  rules: RuleId[];
  priority: number;
  effect: PolicyEffect;
  status: PolicyStatus;
}
```

## 9. Rule
A single declarative condition → effect.

```ts
interface Rule {
  id: RuleId;
  name: string;
  condition: PredicateSpec;     // serializable predicate (not a JS function)
  effect: RuleEffect;
  priority: number;
  scope: PolicyScope;
}
```

## 10. Event
The canonical event. The concrete envelope (`EventEnvelope`) lives in `events`.

```ts
interface Event {
  eventId: string;
  streamId: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  timestamp: number;
  version: number;
  metadata: EventMetadata;
  payload: UnknownPayload;
}
```

## 11. Projection
A materialized read-model definition.

```ts
interface Projection {
  id: ProjectionId;
  name: string;
  sourceEventTypes: string[];
  initialState: UnknownState;
  transform: TransformSpec;
  targetSchema: SchemaRef;
}
```

## 12. Recommendation
A suggested action/decision from simulation or analysis.

```ts
interface Recommendation {
  id: RecommendationId;
  source: RecommendationSource;
  target: RecommendationTarget;
  rationale: string;
  confidence: number;
  proposedAction: ProposedAction;
  createdAt: number;
}
```

## 13. Route
An allocation of resource(s) to task(s) over a schedule.

```ts
interface Route {
  id: RouteId;
  taskId: TaskId;
  resourceId: ResourceId;
  scheduleSlotId: ScheduleSlotId;
  sequence: number;
  constraints: Constraint[];
  status: RouteStatus;
}
```

## 14. Schedule
A temporal plan.

```ts
interface Schedule {
  id: ScheduleId;
  window: ScheduleWindow;
  slots: ScheduleSlot[];
  recurrence?: RecurrenceRule;
  status: ScheduleStatus;
}

interface ScheduleSlot {
  id: ScheduleSlotId;
  scheduleId: ScheduleId;
  start: number;
  end: number;
  resourceId?: ResourceId;
  capacity: Capacity;
}
```

## 15. Decision
An evaluated outcome of a policy/choice.

```ts
interface Decision {
  id: DecisionId;
  decisionType: string;
  subject: DecisionSubject;
  inputs: DecisionInput[];
  outcome: DecisionOutcome;
  rationale: string;
  matchedRules: RuleId[];
  evaluatedAt: number;
  provenance: ProvenanceRef;
}
```

## 16. Simulation
A counterfactual run of a plan against state.

```ts
interface Simulation {
  id: SimulationId;
  scenario: string;
  inputs: SimulationInput[];
  assumedState: UnknownState;
  projectedEvents: Event[];
  outcomes: SimulationOutcome[];
  assumptions: Assumption[];
  ranAt: number;
  seed: number;
}
```

---

## Shared Value Objects

These support the primitives and live in `@kernel/shared-kernel/domain/value-objects/`:

| Value object | Shape |
|---|---|
| `Priority` | `{ level: number; label?: string }` |
| `Quantity` | `{ amount: number; unit: string }` |
| `Constraint` | `{ kind: string; params: UnknownRecord }` (serializable) |
| `TemporalWindow` | `{ start: number; end: number; timezone: string }` |
| `Availability` | `{ windows: TemporalWindow[]; exclusions: TemporalWindow[] }` |
| `Capacity` | `{ max: number; unit: string; per?: TemporalWindow }` |
| `PredicateSpec` | `{ op: string; args: unknown[] }` (serializable predicate DSL) |
| `SchemaRef` | `{ ref: string; version: number }` |
| `ProvenanceRef` | `{ sourceEventIds: string[]; inputHash?: string }` |
| `UnknownPayload` / `UnknownRecord` / `UnknownState` | `Readonly<Record<string, unknown>>` |

All value objects are **immutable** and **serializable** (no functions, no class
instances, no `Date` objects — only epoch numbers).
