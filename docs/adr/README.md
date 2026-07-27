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

## ADR-0012 — Protocols describe work; they never execute it

**Status:** Accepted
**Context:** The Protocol SDK (Milestone 3) turns OpsOS from a kernel into an
extensible OS. If protocols could execute work, the kernel's determinism,
auditability, and replay invariants would be undermined — protocols would
become runtimes, and the clean layering (`compiler compiles, runtime executes,
protocols describe, applications present`) would collapse.
**Decision:** Protocols DESCRIBE work only. They register capabilities, intent
types, compiler stages (extensions, never replacements — names must not start
with `kernel.`), policies, rules, workflows, read models, analytics, UI
extensions, navigation, routes, recommendations, event types, pricing,
marketplace listings, config schemas, localization, and notifications. The
`register(host)` callback runs at install/enable time — OUTSIDE the
deterministic core — and only pushes immutable descriptors. Protocols never
execute runtime operations, never create `ExecutionGraph`s directly, and never
mutate the kernel's live state. The kernel owns lifecycle management
(discovered → validated → installed → enabled ⇄ disabled → upgraded →
uninstalled); protocols cannot change their own lifecycle.
**Consequences:** Adding an industry (cleaning, delivery, healthcare) is an act
of installation, not kernel modification. The kernel remains domain-independent.
The compiler discovers protocol-declared intent types and capabilities
automatically. Protocol-supplied compiler stages extend the pipeline but never
replace kernel stages — the compiler stays deterministic.

## ADR-0013 — Applications are installed instances of protocols

**Status:** Accepted
**Context:** A protocol is a package of operational behavior; it is not a
product. One protocol (e.g. Cleaning) should power many branded applications
(Eks-Clean, Sparkle Cleaning, CleanPro Nigeria, HomeCare Ghana) without
duplicating business logic. Without an Application Runtime, every "product"
would fork the protocol, fragmenting behavior and breaking the OS model.
**Decision:** An Application is an installed, branded, tenant-aware instance of
a protocol, declared by an immutable `ApplicationManifest` (analogous to
Android's `AndroidManifest.xml`). The manifest binds to `protocolId@version`
and declares branding (theme/logo/favicon/email templates), routing
(path-prefix + custom domains), layered configuration (protocol defaults →
org → application → environment), feature flags, navigation, authentication
providers, localization, UI extensions, and installed modules. The kernel owns
lifecycle (draft → installed → configured → active ⇄ suspended → archived →
removed); applications cannot change their own lifecycle. Applications NEVER
contain business logic — they configure and present a protocol. The
ApplicationInstaller validates protocol compatibility, creates the instance,
applies configuration, activates, and rolls back on failure. Applications
hide OpsOS: users never see the kernel.
**Consequences:** One protocol powers thousands of applications. Adding a
product is an act of installation + branding, not protocol forking. The kernel
stays domain-independent (it never reads branding/theme/navigation fields —
those are consumed by the host application layer). Applications can be
upgraded, rolled back, suspended, and archived independently of their
protocol. Multi-tenancy is natural: applications belong to organizations;
organizations own users; applications never own users.

## ADR-0014 — The Control Plane is a read-only admin surface

**Status:** Accepted
**Context:** Without an administrative console, installing and managing
protocols/applications requires ad hoc tooling. Building admin screens later
means they get bolted on rather than designed in. Operating systems ship their
management surface first (kubectl, Docker Desktop, Vercel Dashboard).
**Decision:** The Platform Control Plane is the administrative interface for
managing OpsOS itself. It is NOT an application and is NOT customer-facing —
only platform administrators access it. It renders from a read-only
`PlatformSnapshot` produced by the `ControlPlaneService` (which queries live
registries + lifecycle managers). Mutating operations (install/upgrade/disable/
rollback) go through the lifecycle managers with explicit confirmation — the
control plane never mutates kernel state directly. The control plane surfaces:
protocols, applications, organizations, runtime/compiler/events/projections
explorers, capability/intent/workflow/policy registries, extension manager,
simulation console (replay/step/time-travel), observability dashboards
(metrics/traces/logs/audit/provenance), upgrade manager, and health dashboard.
Applications continue hiding OpsOS completely — the control plane is the ONLY
surface where "OpsOS" is visible.
**Consequences:** OpsOS feels like a real operating system rather than a
library. Administrators can inspect every layer (kernel → compiler → protocols
→ applications) without touching code. Mutations are auditable and confirmed.
The control plane is the primary inspector — all previous inspector views
become tabs within it.

## ADR-0015 — The Coordination Kernel is not a marketplace

**Status:** Accepted
**Context:** Work coordination — deciding WHO performs work — is universal
across industries. An "exchange" or "marketplace" is one coordination strategy
among many; organizations also assign work directly, use fixed schedules, follow
regulatory workflows, or use priority queues. If the coordination layer were
coupled to marketplace semantics, every non-market industry would need to
workaround it.
**Decision:** The Coordination Kernel is a universal coordination engine that
sits between planning (compiler) and execution (runtime). It coordinates WHO
will perform work; it never performs work itself. It introduces 14 canonical
primitives (Offer, Bid, Claim, Reservation, Commitment, Assignment, Agreement,
Contract, Transfer, Delegation, Queue, Escalation, Allocation, Match) and 8
engines (matching, negotiation, reservation, commitment, assignment, queue,
transfer, escalation). Marketplace is ONE strategy implemented ON TOP of the
coordination kernel (using Offers + Bids + Matching), not the kernel itself.
Direct assignment, fixed schedules, and regulatory workflows are equally
first-class — they use Commitments + Assignments + Queues directly without
Offers/Bids. Protocols register 8 extension kinds (matching strategies,
negotiation rules, queue policies, reservation policies, escalation policies,
optimization objectives, capability ranking, availability models); the kernel
orchestrates. The coordination kernel is deterministic: identical (events,
resources, capabilities, policies, clock, config) → identical assignments.
**Consequences:** OpsOS coordinates any operational work in any industry
without knowing what that industry is. A cleaning protocol, mobility protocol,
and healthcare protocol all flow through the same engines. The marketplace —
when built — is a protocol-layer concern, not a kernel concern. The
coordination kernel is the heart of OpsOS: the economy of work.

## ADR-0016 — The Resource Kernel owns what resources ARE

**Status:** Accepted
**Context:** Every operational industry coordinates resources (cleaners,
vacuums, drivers, vehicles, doctors, MRI machines, beds, trucks, bins, guards,
drones). The Coordination Kernel can assign work, but it still doesn't know
what resources ARE — their state, availability, capacity, location, calendar,
skills, certification, twin, maintenance, or quality. Without a universal
resource layer, every protocol would reimplement these concepts, fragmenting
behavior and breaking the OS model.
**Decision:** The Resource Kernel owns universal resource concepts: state (idle,
busy, reserved, committed, offline, maintenance, unavailable, degraded),
availability (state machine), capacity (current/max/remaining/future), location
(geometry/region/zone/hierarchy/movement — NOT raw GPS), calendar (bookings,
blocks, availability windows), skills (capability → requirements →
certification → quality → confidence), digital twin (every resource has one:
current state, history, predictions, telemetry), maintenance (scheduled/
in-progress/completed), and quality metrics. The Coordination Kernel QUERIES
the Resource Kernel ("give me resources capable of X") rather than owning
resources itself. Protocols consume the universal abstractions; they do not
reimplement them. The Resource Kernel sits below the Coordination Kernel in the
dependency graph.
**Consequences:** Adding a new industry no longer requires building resource
management — it's universal. The matching engine becomes dramatically better
because it can query certified, available, capable resources with remaining
capacity. Digital twins belong here (not as a standalone concept) — every
resource has one, giving AI something to reason over. Location is an
abstraction (not GPS) so mobility uses roads, cleaning uses buildings, and
healthcare uses hospital wings through the same interface.

## ADR-0017 — The Knowledge Kernel owns operational knowledge, not protocols

**Status:** Accepted
**Context:** OpsOS knows how to execute, coordinate, and allocate — but it
doesn't know *why*. SOPs, regulations, safety procedures, best practices,
material compatibility, medical guidelines, building codes, and hazard
classifications are universal across every operational industry. If protocols
hardcoded this knowledge, it would be duplicated, unversioned, and impossible to
audit or update independently of protocol code.
**Decision:** The Knowledge Kernel owns universal operational knowledge as
immutable, versioned, provenanced artifacts with confidence + applicability
metadata. It introduces 14 canonical primitives (KnowledgeItem, Fact, Evidence,
Source, Procedure, Standard, Regulation, Guideline, Ontology, Taxonomy,
Vocabulary, Measurement, Hypothesis, Confidence) and 14 registries (one per
artifact type + a KnowledgeQueryEngine). Protocols REGISTER knowledge artifacts
through the Protocol SDK (carrying `ownerProtocolId`); the kernel owns storage,
versioning, provenance, confidence, and applicability. The KnowledgeQueryEngine
exposes immutable, queryable knowledge to the Compiler (what procedures apply?),
Coordination Kernel (find resources certified for SOP-32, compliant with
Regulation-9), Resource Kernel (capability → knowledge → certification →
evidence → confidence), and future AI services. Knowledge is deterministic,
event-sourced, replayable, and independent of storage technology.
**Consequences:** Digital twins become intelligent (twin → knowledge →
recommendations → predictions). The compiler becomes smarter (intent →
knowledge lookup → execution plan). Protocols reference knowledge instead of
reinventing it. Regulations, SOPs, and standards are updateable independently
of protocol code. Training, compliance, and audit become universal. The kernel
is now effectively complete — future work (Cleaning, Mobility, Healthcare)
becomes installed protocols, not kernel development.

## ADR-0018 — Domain Definition (semantics) is separate from Protocol (behavior)

**Status:** Accepted
**Context:** A domain (e.g. Cleaning) is a semantic model — what entities exist
(buildings, rooms, surfaces), their relationships (contains, located_in),
state machines, measurements, constraints, and vocabulary. A protocol is
behavior — compiler extensions, coordination strategies, policies, workflows.
Coupling semantics to behavior means every variant (residential, commercial,
hospital, industrial cleaning) would duplicate the semantic model, and changing
the model would require changing every protocol.
**Decision:** The Domain Modeling Framework introduces `DomainDefinition` as a
first-class, immutable semantic aggregate: entity types, relationships, state
machines, measurements, constraints, vocabulary refs, taxonomy refs, and
ontology bindings. It is separate from `Protocol` (behavior). Many protocols
can share ONE domain definition — e.g. Residential/Commercial/Hospital/Industrial
cleaning protocols all share the Cleaning Domain. The framework provides a DSL
(`defineDomain`, `defineEntityType`, `defineRelationship`, `defineStateMachine`,
`defineMeasurement`, `defineConstraint`) and registries (DomainRegistry,
EntityRegistry). Entity types integrate with the Knowledge Kernel (ontology
bindings, vocabulary refs), Resource Kernel (resource bindings, twin-enabled),
and the compiler (constraint validation). The layering is:
`Knowledge → Domain Definition → Protocol → Application`.
**Consequences:** Creating a new industry becomes almost entirely declarative —
a domain definition plus a protocol installation, no kernel changes. Many
protocols share one domain, so semantics evolve independently of behavior.
Entities automatically become twin-capable and resource-bindable. The compiler
now understands `Intent → Domain Model → Knowledge → Execution Graph` instead
of compiling from an untyped world. The kernel never learns what a "room" or
"patient" is — domains define them.

## ADR-0019 — Applications install operational packages, not protocol source

**Status:** Accepted
**Context:** A protocol is source definitions (manifest + domain bindings +
knowledge refs + contributions). Installing source directly means runtime
validation gaps, no immutability guarantee, no version pinning, no rollback,
no signing, and no offline distribution. Operating systems deploy immutable
packages (Docker images, Helm charts, VS Code extensions) — not source.
**Decision:** The Composition & Operational Package System turns
(Knowledge + Domain Definition + Protocol) into an immutable, validated,
versioned `OperationalPackage` (.opspkg) through a deterministic pipeline:
resolve dependencies → validate → link → bundle → sign → package. The package
is the deployment artifact: it contains a `PackageManifest` (id, version,
apiVersion, kernelVersion, domainVersion, protocolVersion, dependencies,
permissions, checksums, signature, buildMetadata), `PackageContents` (domain
bindings, knowledge refs, compiler extensions, policies, capabilities,
workflows, resources, measurements, UI, APIs, analytics, config defaults),
a `PackageDigest` (deterministic hash), and an optional `PackageSignature`.
Applications install packages ONLY — the kernel never installs protocol source
directly. The installer lifecycle (discovered→validated→linked→packaged→
verified→installed→activated→disabled→removed→rollback→upgrade) operates on
immutable packages. Package signing is an interface (Signer/Verifier/
DigestProvider/SignatureStore) with a demo non-cryptographic signer.
**Consequences:** Protocols feel like first-class OS components, not code
libraries. Packages support signing/verification, dependency resolution,
rollback, offline distribution, marketplace publishing, and kernel-API
compatibility checks. The Protocol SDK becomes the authoring surface; the
Composition Framework becomes the build system. The kernel is now feature-
complete — future work (Cleaning, Mobility, Healthcare) is installed packages,
not kernel development.
