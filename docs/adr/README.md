# OpsOS — Architecture Decision Records

> Decisions frozen for Milestone 1. Changes require a new ADR superseding these.

## ADR-0001 — Layered Clean Architecture per module

**Status:** Accepted
**Context:** The kernel must stay domain-independent and survive many future
protocols. Coupling must be controllable.
**Decision:** Every module uses `domain / application / infrastructure / interfaces`.
Dependency direction is strictly inward. `domain` depends only on
`@kernel/shared-kernel`. `infrastructure` is excluded from the public barrel so
consumers depend on ports (dependency inversion).
**Consequences:** More files; crystal-clear seams; protocols can swap adapters
without touching domain logic.

## ADR-0002 — Determinism via RuntimeClock + seeded RandomSource

**Status:** Accepted
**Context:** Operational decisions must be replayable and auditable. Hidden time
or randomness breaks replay.
**Decision:** `Date.now()`, `new Date()`, `Math.random()` are **forbidden** in
`domain/` and `application/`. All time → `ExecutionContext.clock` (a
`RuntimeClock` port). All randomness → `ExecutionContext.random` (a seeded
`RandomSource` port). The single allowed `Date.now()` is inside
`SystemRuntimeClock` infrastructure impl.
**Consequences:** Replays reproduce identical state; simulations are
deterministic; tests can freeze time.

## ADR-0003 — Event Sourcing as the write-model truth

**Status:** Accepted
**Context:** Operational history is itself a product (audit, replay, analytics).
**Decision:** Aggregates emit immutable events; state is derived by replay.
`EventStore.append` enforces optimistic concurrency via `expectedVersion`.
Snapshots are an optimization only — state is always reconstructable from events.
**Consequences:** Append-only storage fits; projections derive all read models;
no in-place mutation of aggregates.

## ADR-0004 — CQRS: commands vs projections

**Status:** Accepted
**Context:** Write paths (validation, concurrency) and read paths (shape, speed)
have opposed requirements.
**Decision:** Commands flow through event-sourced aggregates. Queries read
**projections only** and never mutate them. Projections are pure
`(event, state) → state` functions rebuilt by the engine.
**Consequences:** Read models can be dropped and rebuilt; no read/write lock
contention; clear separation of concerns.

## ADR-0005 — Identity and Organizations are separate bounded contexts

**Status:** Accepted
**Context:** The spec lists both. Coupling authentication to tenancy creates
circular deps and limits SSO/tenancy flexibility.
**Decision:** `identity` owns authentication principals (`User`, `Principal`,
`Role`, `Permission`, `IdentityProvider`). `organizations` owns tenancy
(`Organization`, `Tenant`, `Membership`). Identity holds `OrganizationId` as an
opaque branded ID; it never imports from `organizations`.
**Consequences:** A principal can exist before joining an org; multi-org
membership is natural; no circular dependency.

## ADR-0006 — Protocols as plugins; kernel ships host + registry only

**Status:** Accepted
**Context:** Cleaning/delivery/healthcare must not live in the kernel.
**Decision:** `extension` module defines `Plugin`, `ExtensionHost`,
`ExtensionRegistry`, and 9 registration contracts. Milestone 1 ships the host +
registry + contracts — **no protocol plugins**. Algorithms (dispatch, routing,
pricing) are protocol-supplied.
**Consequences:** Kernel stays industry-neutral; protocols compose primitives
without kernel changes; marketplace/protocol lifecycle is a future milestone.

## ADR-0007 — Serializable predicates, not JS functions, in policies/rules

**Status:** Accepted
**Context:** Policies must be replayable, portable, and inspectable.
**Decision:** `Rule.condition` is a `PredicateSpec` (`{ op, args }`) evaluated by
a kernel-provided evaluator. No raw JS functions in rules.
**Consequences:** Rules serialize to JSON; replay is exact; rules can be shared
across tenants and audited.

## ADR-0008 — Scheduling is a port in Milestone 1

**Status:** Accepted
**Context:** Dispatch algorithms are protocol-specific.
**Decision:** Ship `Schedule`/`ScheduleSlot`/`Scheduler` port + `NoopScheduler`
placeholder only. No algorithm in the kernel.
**Consequences:** Kernel compiles and runs; protocols plug in real schedulers later.

## ADR-0009 — The kernel exposes a versioned, frozen public API

**Status:** Accepted
**Context:** Operating systems do not evolve by constantly changing core
interfaces. If protocols import internal implementation classes, every kernel
refactor churns every consumer.
**Decision:** The kernel exposes its public contract through a versioned
facade at `@kernel/api/v1`. Everything outside the kernel (protocols,
applications, the admin console, tests) imports ONLY from `@kernel/api/v1`,
never from internal `@kernel/<module>` paths. `v1` is frozen: breaking changes
require a new version directory (`v2/`) with a migration path; additive
evolution (new optional fields, new exported types, new sanctioned adapters) is
permitted within v1.
**Consequences:** Internal modules may refactor freely — the v1 barrel absorbs
refactors so consumers do not. Protocol developers build against a stable
surface. Version bumps are explicit, deliberate, and migration-bearing.

## ADR-0010 — The canonical language is frozen and immutable

**Status:** Accepted
**Context:** The canonical primitives (Intent, Demand, Task, ExecutionPlan,
Execution, Capability, Resource, Workflow, Policy, Rule, Decision, Event,
Projection, Recommendation, Route, Schedule, Simulation, Observation, Twin)
are the CPU instructions of OpsOS. Once protocols, the compiler, and
applications depend on these names, changing them is exponentially expensive.
**Decision:** The v1 canonical language (19 primitives) is FROZEN. The names
and the existence of their fields do not change. Evolution is strictly
additive: new primitives may be added; new optional fields may be added;
existing names/fields are never removed or renamed within v1. Breaking changes
require a new canonical-language version (v2) shipped under a new API version.
**Consequences:** Protocols can reference canonical names with certainty. The
compiler, runtime, and projections are built against stable nouns. The
language grows; it does not shift.

## ADR-0011 — The compiler creates work; the runtime executes work

**Status:** Accepted
**Context:** Without a compiler, there is no disciplined path from an `Intent`
to an `ExecutionGraph`. If the runtime created work ad hoc, the separation
between "what should happen" and "what did happen" collapses, and operational
auditability/replay is lost.
**Decision:** A dedicated `compiler` module transforms an `Intent` into an
`ExecutionGraph` through a staged, replaceable pipeline
(`Normalizer → Validator → PolicyEvaluator → CapabilityResolver → Planner →
Optimizer → Scheduler → Router → GraphBuilder`). The compiler is the ONLY
component that creates work. The runtime ONLY executes work
(`ExecutionGraph → Execution`). The runtime never creates work; the compiler
never executes work. Each pipeline stage is replaceable; protocols register
additional stages via the extension system; the kernel orchestrates ordering.
**Consequences:** The `Intent → compile() → ExecutionGraph → execute() →
Execution` arc is the single, auditable spine of every operational action.
Work creation is inspectable, replayable, and policy-gated before any side
effects occur. Protocols extend the compiler by registering stages, not by
forking it.
