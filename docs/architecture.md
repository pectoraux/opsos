# OpsOS — Kernel Architecture

> **Milestone 1 — Kernel Foundation.**
> This document defines the immutable, domain-independent core of OpsOS.
> After this milestone OpsOS does **not** know what cleaning, laundry, delivery,
> healthcare, or any industry is. It understands only universal operational
> concepts. Industry behavior is installed later as **protocols** (plugins).

---

## 1. What OpsOS Is — and Is Not

OpsOS is an **AI-native Operations Operating System**. It is the *kernel* upon
which operational businesses are later installed as protocols.

| OpsOS **is** | OpsOS **is not** |
|---|---|
| A deterministic runtime for operational decisions | A SaaS application |
| An event-sourced kernel with CQRS | A cleaning platform |
| A plugin host for industry protocols | A marketplace |
| A set of universal operational primitives | A booking system |
| A projection engine feeding read-only views | A protocol itself |

The kernel must remain capable of supporting cleaning, delivery, healthcare,
beauty, security, construction — **all of them, without modification** — because
it contains none of their concepts.

---

## 2. Architectural Principles

| Principle | Enforced How |
|---|---|
| **Clean Architecture** | Layered modules: `domain / application / infrastructure / interfaces`. Dependency direction is strictly inward. |
| **Domain-Driven Design** | Each module is a bounded context with its own aggregates, value objects, domain events, and repositories. |
| **CQRS** | Commands mutate state via the write model (event-sourced aggregates); queries read projections only. Read models are never mutated by query code. |
| **Event Sourcing** | Aggregate state is derived by replaying immutable events. Snapshots are an optimization, not the source of truth. |
| **Deterministic Runtime** | Same inputs → same outputs. All time flows through `RuntimeClock`. All randomness flows through a seeded `RandomSource`. No hidden mutable state. |
| **Immutability** | Everything important produces immutable events. Projections are pure functions of events. |
| **Strict Dependency Direction** | `interfaces → application → domain`; `infrastructure → application → domain`. `domain` depends only on `@kernel/shared-kernel`. |

### 2.1 Determinism Contract

A kernel execution is **deterministic** if and only if:

1. **No direct time access.** `Date.now()`, `new Date()`, `performance.now()`,
   `setTimeout`/`setInterval` are **forbidden** in `domain/` and `application/`.
   All time comes from the injected `RuntimeClock` provided by `ExecutionContext`.
2. **No direct randomness.** `Math.random()` is forbidden in `domain/` and
   `application/`. Use the seeded `RandomSource` from `ExecutionContext`.
3. **No hidden mutable state.** Module-level mutable variables, singletons with
   state, and global registries holding runtime data are forbidden inside the
   deterministic core. Registries are explicit, injected objects.
4. **Pure transitions.** A command handler is a pure function
   `(state, command, ctx) → events`. It must not perform I/O except through
   explicitly injected ports (repositories, clocks, ports declared on the context).
5. **Replayability.** Replaying the same event stream through the same aggregate
   must reconstruct identical state, given an identical `ExecutionContext`.

The **only** place `Date.now()` may appear is the `SystemRuntimeClock`
implementation in `kernel/runtime/infrastructure/` (and test clocks in tests,
which this milestone does not produce).

---

## 3. Module Map

The kernel is organized into packages under `kernel/`. Each module follows the
four-layer structure.

```
kernel/
├── shared-kernel/     # canonical primitives, branded IDs, versioning, Result, ports
├── events/            # EventEnvelope, EventStore, SnapshotStore, event-sourced repo
├── observability/     # Tracer, Meter, Logger, AuditSink, Provenance (interfaces)
├── config/            # ConfigSource, ConfigRegistry, secrets (interfaces)
├── runtime/           # RuntimeClock impl, ExecutionContext, Executor, Graph, State
├── identity/          # User, Principal, Role, Permission, IdentityProvider, Auth
├── organizations/     # Organization, Tenant, Membership (tenancy context)
├── projections/       # ProjectionEngine, ProjectionDefinition, ProjectionStore
├── policy/            # PolicyEngine, PolicyDefinition, Rule, Decision
├── scheduling/        # Schedule, ScheduleSlot, Scheduler interface (foundation only)
└── extension/         # Plugin, ExtensionHost, ExtensionRegistry, registration contracts
```

Each module directory contains:

```
<module>/
├── domain/            # aggregates, entities, value objects, domain events, ports
├── application/       # command/query handlers, services, use-cases (CQRS split)
├── infrastructure/    # in-memory / adapter implementations of ports
└── interfaces/        # public barrel (index.ts) re-exporting the module's contract
```

### 3.1 Per-Module Layers

| Layer | May depend on | May not depend on |
|---|---|---|
| `domain/` | `@kernel/shared-kernel` only | any other module's `application/infrastructure/interfaces` |
| `application/` | own `domain/`, `@kernel/shared-kernel`, declared kernel ports (events, observability, config, runtime) | `infrastructure/`, `interfaces/` |
| `infrastructure/` | own `application/`+`domain/`, `@kernel/shared-kernel`, external libs | other modules' `interfaces/` (only ports) |
| `interfaces/` | own `application/`+`domain/` (re-export only) | `infrastructure/` (keep public surface impl-free) |

---

## 4. The 16 Canonical Operational Primitives

These are the **only** domain concepts the kernel knows. They live in
`@kernel/shared-kernel/domain/primitives/`. No primitive carries any
industry-specific field.

> `Intent · Demand · Task · ExecutionPlan · Capability · Resource · Workflow ·
> Policy · Rule · Event · Projection · Recommendation · Route · Schedule ·
> Decision · Simulation`

Full field-level specification: see [`primitives.md`](./primitives.md).

Each primitive is an **abstract canonical type**. Concrete realizations live in
the module that owns the behavior:

| Primitive | Owned/realized by |
|---|---|
| `Event` | `events` (as `EventEnvelope`) |
| `Projection` | `projections` (as `ProjectionDefinition` + read models) |
| `Policy`, `Rule`, `Decision` | `policy` |
| `Schedule`, `Route` | `scheduling` |
| `Intent`, `Demand`, `Task`, `ExecutionPlan`, `Capability`, `Resource`, `Workflow`, `Recommendation`, `Simulation` | `runtime` (execution model) + `shared-kernel` (canonical types) |

---

## 5. Event System

Every important state change is an immutable event.

### 5.1 EventEnvelope

```ts
interface EventEnvelope<TPayload = unknown> {
  eventId: string;            // UUID v4, unique
  streamId: string;           // aggregate stream = aggregateId
  aggregateId: string;
  aggregateType: string;      // e.g. "Organization", "User"
  eventType: string;          // e.g. "OrganizationCreated"
  timestamp: number;          // epoch millis FROM RuntimeClock (never Date.now())
  version: number;            // monotonic per-stream, for optimistic concurrency
  metadata: EventMetadata;    // correlation/causation/principal/org/trace
  payload: TPayload;          // typed per event
}

interface EventMetadata {
  correlationId: string;
  causationId?: string;       // event or command that caused this one
  principalId?: string;
  tenantId?: string;
  traceId?: string;
  source?: string;            // module/protocol that emitted it
  [k: string]: unknown;
}
```

### 5.2 EventStore (port)

```ts
interface EventStore {
  append(streamId, events, expectedVersion): Promise<AppendResult>;
  readStream(streamId, fromVersion?): Promise<EventEnvelope[]>;
  readAll(fromPosition?): AsyncIterable<EventEnvelope>;  // projection catch-up
  subscribe(handler): Subscription;                       // live projections
}
```

`append` performs **optimistic concurrency**: if `expectedVersion` does not match
the stream's current version, it rejects with `ConcurrencyConflictError`.

### 5.3 SnapshotStore (port, optimization only)

```ts
interface SnapshotStore {
  load(aggregateId): Promise<Snapshot | null>;
  save(snapshot): Promise<void>;
}
```

Snapshots are **never** the source of truth. State is always reconstructable from
events.

### 5.4 EventSourcedRepository<TAggregate>

A generic repository that:
1. Loads the latest snapshot (if any).
2. Replays events from `snapshot.version + 1` onward.
3. Applies them via the aggregate's `apply` reducer.
4. On save: reads expected version, appends new events with concurrency check.

---

## 6. Runtime

The deterministic execution engine.

| Abstraction | Responsibility |
|---|---|
| `RuntimeClock` | `now(): number` (epoch ms); `tick(): number` (monotonic logical). Abstract; `SystemRuntimeClock` in infra uses real time; test clocks are injectable. |
| `RandomSource` | Seeded RNG: `next(): number`, `uuid(): string`, `pick<T>(arr): T`. Deterministic for a given seed. |
| `ExecutionContext` | Carries `clock`, `random`, `principal`, `tenantId`, `correlationId`, `traceId`, `config`, `observability` handles, `metadata`. Passed to every handler. |
| `ExecutionGraph` | DAG of `ExecutionNode`s (id, operation ref, inputs, dependencies). |
| `ExecutionNode` | A single deterministic operation in the graph. |
| `RuntimeExecutor` | Topologically executes a graph, threading `ExecutionContext`, collecting emitted events + `ExecutionResult`. Execution order is deterministic given the graph + seed. |
| `RuntimeState` | Immutable state container; transitions only via events. |
| `ExecutionResult` | `outputs`, `eventsEmitted`, `decisions`, `metrics`, `provenance`. |

### 6.1 Deterministic Execution Rule

```
execute(graph, inputState, ctx) → { result, newState, events }
```

is a **pure function** of `(graph, inputState, ctx.seed)`. Two executions with
identical inputs and identical `ctx` (same clock time, same seed) produce
byte-identical results.

---

## 7. Identity & Organizations (split)

The spec lists both `Identity` and `Organizations`. They are **separate bounded
contexts** to avoid coupling authentication to tenancy:

| Module | Owns | Concern |
|---|---|---|
| `identity` | `User`, `Principal`, `Role`, `Permission`, `Credential`, `IdentityProvider`, `Authenticator`, `AuthSession` | **Who is the actor?** Authentication + principal model. References `OrganizationId` as an opaque branded ID. |
| `organizations` | `Organization`, `Tenant`, `Membership` | **What org/tenant is the actor acting in?** Tenancy + org structure. |

Identity depends on `shared-kernel` + `events`. Organizations depends on
`identity` (for `Principal`/`User` references) + `events`. Identity never imports
from organizations — it holds only the opaque `OrganizationId`.

---

## 8. Observability

Everything executed is traceable.

| Port | Surface |
|---|---|
| `Tracer` | `startSpan(name, ctx?)`, span context propagation |
| `Meter` | `counter`, `gauge`, `histogram` |
| `Logger` | structured logging with levels + context |
| `AuditSink` | `record(auditEvent)` — who/what/when/what-changed |
| `ProvenanceRecorder` | `recordDecision(decision, inputs, sourceEvents)` — decision provenance |

`ExecutionContext.observability` bundles these. A `NoopObservability` impl is
provided in `infrastructure` for tests/headless runs.

---

## 9. Extension System (Protocol Host)

Protocols are the *applications* installed on the kernel. A protocol registers:

| Registration contract | Registers |
|---|---|
| `CapabilityRegistration` | a `Capability` offered by a resource/actor |
| `IntentTypeRegistration` | a new `Intent` type + schema |
| `WorkflowStageRegistration` | a stage in a `Workflow` |
| `PolicyRegistration` | a `Policy` bundle |
| `RuleRegistration` | a single `Rule` |
| `UIExtensionRegistration` | a UI extension point (interface only — no impl in kernel) |
| `AnalyticsRegistration` | an analytics producer |
| `ApiRouteRegistration` | an API route (interface only) |
| `MarketplaceExtensionRegistration` | a marketplace listing |

```ts
interface Plugin {
  manifest: ExtensionManifest;   // id, version, name, protocolId?, dependencies
  register(host: ExtensionHost): void;
}
```

`ExtensionHost` exposes typed registrars for each contract. The kernel provides
the host + registry; protocols provide plugins. **Milestone 1 ships the host and
registry only — no protocol plugins.**

---

## 10. Scheduling Foundation (no algorithms)

Milestone 1 ships scheduling **types and interfaces only**:

- `Schedule`, `ScheduleSlot`, `RecurrenceRule`, `ScheduleWindow`
- `Scheduler` port: `plan(demands, resources, constraints) → ExecutionPlan`
- `SchedulePolicy`: declarative constraints (no dispatch algorithm)

Concrete dispatch/routing algorithms are protocol-specific and installed later.

---

## 11. Configuration

- `ConfigSchema` — typed schema for a config namespace.
- `ConfigSource` port — `get<T>(key)`, `watch(key, cb)`.
- `ConfigRegistry` — merges sources with declared precedence.
- `Secrets` — secret handle (never logs raw value).

Provided impls: `InMemoryConfigSource`, `EnvConfigSource` (read-only).

---

## 12. What This Milestone Explicitly Does NOT Build

- ❌ No business logic, no protocol, no application behavior
- ❌ No REST/HTTP API routes (only interface contracts for future routes)
- ❌ No Prisma models / database persistence (only in-memory adapters + port interfaces)
- ❌ No login screens / authentication UI
- ❌ No scheduling algorithms / dispatch
- ❌ No marketplace / payments
- ❌ No industry-specific fields anywhere

---

## 13. Verification Standard of Done for Milestone 1

1. `tsc --noEmit` passes (strict).
2. `bun run lint` passes.
3. Every module exposes a typed `interfaces/index.ts` barrel.
4. No `domain/` file imports from another module's `application/`,
   `infrastructure/`, or `interfaces/`.
5. No `Date.now()` / `Math.random()` in any `domain/` or `application/` file.
6. A read-only kernel inspector (`/`) renders, loads the kernel, and demonstrates
   a deterministic event flow end-to-end (proves the skeleton is real, not dead types).
