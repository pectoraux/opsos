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
