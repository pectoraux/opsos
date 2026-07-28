# OpsOS — Canonical Operational Primitives

> **CANONICAL LANGUAGE v1 — FROZEN (ADR-0010).** These names are the CPU
> instructions of OpsOS. Once frozen they do not change. Evolution is
> **additive only** (new primitives, new optional fields); breaking changes
> require a new API version (v2), never an in-place mutation of v1.

> The **only** domain concepts the kernel knows. Every primitive is
> **domain-independent**. None carries any industry-specific field.
> Cleaning, delivery, healthcare, etc. are expressed later by composing these
> primitives inside protocols — never by extending the kernel.

All primitives live in `@kernel/shared-kernel/domain/primitives/`. They are
abstract canonical *types* (interfaces + branded IDs). Concrete realizations
are owned by the module listed in [`architecture.md §4`](./architecture.md).

The v1 canonical language contains **19** primitives:

`Intent · Demand · Task · ExecutionPlan · Execution · Capability · Resource ·
Workflow · Policy · Rule · Decision · Event · Projection · Recommendation ·
Route · Schedule · Simulation · Observation · Twin`

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

## 17. Execution

The runtime act AND result of running an `ExecutionPlan`'s `ExecutionGraph`.
Distinct from the plan: the plan is *what should happen*; the execution is
*what did happen*. The compiler produces a plan + graph; the runtime produces
an execution by running the graph.

```ts
interface Execution {
  id: ExecutionId;
  planId: ExecutionPlanId;
  intentId: IntentId;
  status: ExecutionStatus;        // queued | running | paused | completed | failed | cancelled
  startedAt: number;
  endedAt?: number;
  steps: ExecutionStep[];         // per-node results
  observations: ObservationId[];  // observations emitted during execution
  decisions: DecisionId[];        // decisions made during execution
  finalState?: UnknownState;
  seed: number;                   // determinism anchor
}
```

> **Load-bearing distinction:** Protocols COMPILE work (Intent → ExecutionPlan +
> ExecutionGraph). The runtime EXECUTES work (ExecutionGraph → Execution). The
> runtime never creates work; the compiler never executes work.

## 18. Observation

An observed fact about the world — the feedback channel that closes the
operational loop. Observations flow back into decisions, planning, and twins.
Immutable and provenanced.

```ts
interface Observation {
  id: ObservationId;
  observedAt: number;             // from RuntimeClock
  observer: ResourceId | PrincipalId;
  subject: { kind: string; id: string };
  metric?: string;
  value: unknown;                 // validated by consumer
  confidence: number;             // 0..1
  source: "sensor" | "report" | "inference" | "system";
  provenance: ProvenanceRef;
}
```

## 19. Twin

A digital twin: a MODELED representation of a real-world resource (or system)
that the compiler and runtime reason against. Twins carry the assumed/estimated
state used for planning, simulation, and what-if analysis. `fidelity` expresses
how trustworthy the model is.

```ts
interface Twin {
  id: TwinId;
  resourceId?: ResourceId;
  resourceType?: string;
  modelType: string;              // protocol vocabulary
  state: UnknownState;
  updatedAt: number;              // from RuntimeClock
  fidelity: number;               // 0..1
  assumptions: Assumption[];
  validUntil?: number;            // expiry epoch-ms
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
