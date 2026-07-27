# OpsOS — Module Reference

Each module is a bounded context. This document fixes the **public contract**
(each module's `interfaces/index.ts` surface) so that parallel implementation
cannot drift.

Legend: `[F]` = foundation (no kernel deps beyond shared-kernel/events),
`[P]` = port (interface only), `[I]` = in-memory implementation provided.

---

## shared-kernel `[F]`

**Owns:** branded identifiers, versioning, `Result`/`Option`, value objects,
the 16 canonical primitives (as abstract types), `RuntimeClock` &
`RandomSource` *ports* (the abstract interfaces), shared error types.

**Public surface (`@kernel/shared-kernel`):**
- Identifiers: `IntentId`, `DemandId`, `TaskId`, `ExecutionPlanId`,
  `CapabilityId`, `ResourceId`, `WorkflowId`, `PolicyId`, `RuleId`,
  `ProjectionId`, `RecommendationId`, `RouteId`, `ScheduleId`, `ScheduleSlotId`,
  `DecisionId`, `SimulationId`, `UserId`, `PrincipalId`, `RoleId`,
  `PermissionId`, `OrganizationId`, `TenantId`, `AggregateId`, `StreamId`,
  `EventId`.
- Core: `Brand`, `Result<T,E>`, `ok`, `err`, `Option<T>`, `some`, `none`,
  `Version` (monotonic version counter), `ClockTime`.
- Ports: `RuntimeClock` (abstract interface), `RandomSource` (abstract interface).
- Value objects: `Priority`, `Quantity`, `Constraint`, `TemporalWindow`,
  `Availability`, `Capacity`, `PredicateSpec`, `SchemaRef`, `ProvenanceRef`,
  `UnknownPayload`, `UnknownRecord`, `UnknownState`, `AttributeMap`.
- Primitives: the 16 canonical types (see `primitives.md`).
- Errors: `KernelError`, `ConcurrencyConflictError`, `ValidationError`,
  `NotFoundError`, `UnauthorizedError`, `DeterminismViolationError`.

**Depends on:** nothing.

---

## events `[F]`

**Owns:** `EventEnvelope`, `EventMetadata`, `EventStore` `[P]`, `SnapshotStore`
`[P]`, `EventSourcedRepository<T>`, `AppendResult`, `Subscription`,
`EventStreamCursor`, `Snapshot`.

**Public surface (`@kernel/events`):** all of the above + `InMemoryEventStore`
`[I]`, `InMemorySnapshotStore` `[I]`, `aggregateStreamId(type, id)` helper.

**Key invariants:**
- `append` enforces optimistic concurrency via `expectedVersion`.
- `EventEnvelope.timestamp` MUST be sourced from `ExecutionContext.clock`.
- `EventEnvelope.version` is monotonically increasing per `streamId`.

**Depends on:** `@kernel/shared-kernel`.

---

## observability `[F]`

**Owns:** `Tracer` `[P]`, `Meter` `[P]`, `Logger` `[P]`, `AuditSink` `[P]`,
`ProvenanceRecorder` `[P]`, `ObservabilityBundle`, `Span`, `SpanContext`,
`AuditEvent`, `MetricSeries`, `LogRecord`, `DecisionProvenance`.

**Public surface (`@kernel/observability`):** all ports + `NoopObservability` `[I]`
+ `ConsoleLogger` `[I]` + `InMemoryAuditSink` `[I]` + `InMemoryMeter` `[I]`.

**Depends on:** `@kernel/shared-kernel`.

---

## config `[F]`

**Owns:** `ConfigSchema`, `ConfigSource` `[P]`, `ConfigRegistry`, `Secrets` `[P]`,
`ConfigKey`, `ConfigValue`, `ConfigWatcher`.

**Public surface (`@kernel/config`):** all of the above +
`InMemoryConfigSource` `[I]`, `EnvConfigSource` `[I]` (read-only),
`MapConfigRegistry` `[I]`.

**Depends on:** `@kernel/shared-kernel`.

---

## runtime

**Owns:** `SystemRuntimeClock` `[I]` (the ONLY place `Date.now()` is allowed),
`FixedRuntimeClock` `[I]` (test/deterministic), `SeededRandomSource` `[I]`,
`ExecutionContext`, `ExecutionContextBuilder`, `ExecutionGraph`, `ExecutionNode`,
`RuntimeExecutor` `[P]` + `DeterministicRuntimeExecutor` `[I]`, `RuntimeState`,
`ExecutionResult`, `OperationHandler` `[P]`, `OperationRegistry`.

**Public surface (`@kernel/runtime`):** all of the above.

**Key invariants:**
- `ExecutionContext.clock` and `ExecutionContext.random` are the *only* sanctioned
  sources of time/randomness in `domain/` and `application/` layers.
- `DeterministicRuntimeExecutor` executes a graph in topological order; ties
  broken deterministically by `(nodeId)` lexicographic order — never by
  insertion timing.
- `ExecutionResult` is a pure projection of `(graph, inputState, ctx)`.

**Depends on:** `@kernel/shared-kernel`, `@kernel/events`, `@kernel/observability`,
`@kernel/config`.

---

## identity

**Owns:** `User` (aggregate), `Principal`, `Role`, `Permission`, `Credential`
(value object), `IdentityProvider` `[P]`, `Authenticator` `[P]`, `AuthSession`,
identity domain events (`UserRegistered`, `UserActivated`, `RoleAssigned`, …),
`UserRepository` `[P]`.

**Public surface (`@kernel/identity`):** all of the above +
`InMemoryUserRepository` `[I]` + `InMemoryIdentityProvider` `[I]` (echo provider
for kernel self-test, not production auth).

**Key invariants:**
- Holds `OrganizationId` as an opaque branded ID — never imports from `organizations`.
- Authentication interfaces only; **no login UI, no HTTP routes**.
- `Principal` is the runtime security identity carried by `ExecutionContext`.

**Depends on:** `@kernel/shared-kernel`, `@kernel/events`, `@kernel/observability`.

---

## organizations

**Owns:** `Organization` (aggregate), `Tenant`, `Membership` (aggregate),
organization domain events (`OrganizationCreated`, `MemberAdded`, `RoleGranted`, …),
`OrganizationRepository` `[P]`, `MembershipRepository` `[P]`, `TenancyContext`.

**Public surface (`@kernel/organizations`):** all of the above +
`InMemoryOrganizationRepository` `[I]` + `InMemoryMembershipRepository` `[I]`.

**Key invariants:**
- Organization references `PrincipalId`/`UserId` (opaque) from identity.
- `TenantId` is the data-isolation boundary; every kernel command is scoped by it.

**Depends on:** `@kernel/shared-kernel`, `@kernel/events`, `@kernel/observability`,
`@kernel/identity` (interface only).

---

## projections

**Owns:** `ProjectionDefinition<TState>`, `ProjectionEngine` `[P]`,
`ProjectionStore` `[P]`, `ReadModel`, `ProjectionRebuilder`,
`InMemoryProjectionEngine` `[I]`, `InMemoryProjectionStore` `[I]`.

**Public surface (`@kernel/projections`):** all of the above.

**Key invariants:**
- Projections are **pure functions** of events: `(event, state) → state`.
- Read models are **never mutated** by query code; they are rebuilt only by the
  engine replaying events.
- Supports both live subscription and rebuild-from-all-events.

**Depends on:** `@kernel/shared-kernel`, `@kernel/events`, `@kernel/observability`,
`@kernel/runtime` (for `ExecutionContext`).

---

## policy

**Owns:** `PolicyDefinition`, `Rule`, `PredicateSpec` evaluator,
`PolicyEngine` `[P]`, `Decision`, `PolicyEvaluationContext`, `DecisionOutcome`,
`InMemoryPolicyEngine` `[I]`.

**Public surface (`@kernel/policy`):** all of the above.

**Key invariants:**
- `Rule.condition` is a serializable `PredicateSpec`, **not** a JS function — so
  policies are replayable and portable.
- `Decision` carries `matchedRules` + `provenance` (source event/input hashes).
- Evaluation order: rules sorted by `(priority desc, id asc)` — deterministic.

**Depends on:** `@kernel/shared-kernel`, `@kernel/events`, `@kernel/observability`,
`@kernel/runtime`.

---

## scheduling

**Owns:** `Schedule`, `ScheduleSlot`, `ScheduleWindow`, `RecurrenceRule`,
`Scheduler` `[P]`, `SchedulePolicy`, `ScheduleRequest`, `ScheduleResult`,
`NoopScheduler` `[I]` (returns empty plan — foundation only).

**Public surface (`@kernel/scheduling`):** all of the above.

**Key invariants:**
- **No dispatch/routing algorithm in Milestone 1.** `Scheduler` is a port;
  `NoopScheduler` is a placeholder so the kernel compiles and runs.
- Algorithms are protocol-specific and installed later via the extension system.

**Depends on:** `@kernel/shared-kernel`, `@kernel/events`, `@kernel/runtime`.

---

## extension

**Owns:** `Plugin`, `ExtensionManifest`, `ExtensionHost`, `ExtensionRegistry`,
`ExtensionContext`, the 9 registration contracts
(`CapabilityRegistration`, `IntentTypeRegistration`, `WorkflowStageRegistration`,
`PolicyRegistration`, `RuleRegistration`, `UIExtensionRegistration`,
`AnalyticsRegistration`, `ApiRouteRegistration`, `MarketplaceExtensionRegistration`),
`InMemoryExtensionRegistry` `[I]`, `DefaultExtensionHost` `[I]`.

**Public surface (`@kernel/extension`):** all of the above.

**Key invariants:**
- `ExtensionHost` exposes typed registrars; `register()` is the only mutation
  surface and is **not** part of the deterministic core (it runs at boot/protocol
  install time, outside `RuntimeExecutor`).
- No protocol plugins ship in Milestone 1 — only the host + registry + contracts.

**Depends on:** `@kernel/shared-kernel` (interfaces only). It references the
other modules' primitive *types* (e.g. `Capability`, `Policy`) via
`shared-kernel`, not via direct module imports, to stay decoupled.

---

## Cross-Module Imports Allowed

```
shared-kernel          ← (nothing)
events                 ← shared-kernel
observability          ← shared-kernel
config                 ← shared-kernel
runtime                ← shared-kernel, events, observability, config
identity               ← shared-kernel, events, observability
organizations          ← shared-kernel, events, observability, identity
projections            ← shared-kernel, events, observability, runtime
policy                 ← shared-kernel, events, observability, runtime
scheduling             ← shared-kernel, events, runtime
extension              ← shared-kernel  (registry references primitive types only)
```

Every other import direction is **forbidden** (enforced by review + the
dependency-graph doc).
