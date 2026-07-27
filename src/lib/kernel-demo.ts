/**
 * Kernel self-test / inspector demo.
 *
 * Wires the OpsOS kernel's in-memory adapters and exercises a deterministic,
 * end-to-end flow that PROVES the skeleton is real (not dead types):
 *
 *   1. Event Sourcing — append 3 events to an Organization stream with
 *      optimistic concurrency; read them back with monotonic versions.
 *   2. Determinism — the same seed produces the same UUID sequence, so the
 *      generated eventIds are byte-identical across runs (replay invariant).
 *   3. CQRS read side — a PURE projection derives a read model from the events.
 *   4. Policy — a serializable PredicateSpec rule evaluates to a Decision with
 *      provenance.
 *   5. Extension host — a (fake) protocol plugin registers capabilities &
 *      intent types through the ExtensionHost.
 *   6. Compiler — an Intent flows through the 9-stage pipeline and emerges as
 *      an ExecutionGraph (ADR-0011: the compiler creates work; the runtime
 *      executes it).
 *
 * Runs entirely on the backend (server component). No Date.now() leaks —
 * time comes from a FixedRuntimeClock; randomness from a SeededRandomSource.
 */

import {
  asId,
  aggregateStreamId,
  ANY_VERSION,
} from "@kernel/shared-kernel";
import { InMemoryEventStore } from "@kernel/events";
import type { EventInput, EventEnvelope } from "@kernel/events";
import { SeededRandomSource, FixedRuntimeClock } from "@kernel/runtime";
import {
  InMemoryProjectionStore,
  InMemoryProjectionEngine,
} from "@kernel/projections";
import type { ProjectionDefinition } from "@kernel/projections";
import { InMemoryPolicyEngine } from "@kernel/policy";
import type { PolicyDefinition } from "@kernel/policy";
import {
  InMemoryExtensionRegistry,
  DefaultExtensionHost,
  installPlugin,
} from "@kernel/extension";
import type { Plugin } from "@kernel/extension";
import {
  DefaultCompilerPipeline,
  createDefaultStages,
  createCompilationContext,
} from "@kernel/compiler";
import type { CompilationContext } from "@kernel/compiler";
import { NoopScheduler } from "@kernel/scheduling";
import {
  ProtocolRegistry,
  DefaultLifecycleManager,
  demoProtocol,
} from "@kernel/protocol-sdk";
import type {
  ProtocolManifest,
  ProtocolLifecycleState,
  LifecycleEvent,
} from "@kernel/protocol-sdk";
import {
  InMemoryApplicationRegistry,
  DefaultApplicationLifecycleManager,
  installApplication,
  eksCleanDemoApplication,
  resolveBranding,
  resolveConfiguration,
  resolveFeatureFlags,
  resolveNavigation,
  resolveRouting,
  resolveAuthentication,
  resolveLocalization,
} from "@kernel/application-runtime";
import type {
  ApplicationLifecycleState,
  Application as AppRecord,
} from "@kernel/application-runtime";
import {
  CoordinateWorkUseCase,
  InMemoryMatchingEngine,
  InMemoryReservationEngine,
  InMemoryCommitmentEngine,
  InMemoryAssignmentEngine,
} from "@kernel/coordination";
import type { CoordinateWorkResult } from "@kernel/coordination";
import {
  InMemoryResourceRegistry,
  InMemoryAvailabilityEngine,
  InMemoryCapacityTracker,
  InMemorySkillRegistry,
  InMemoryTwinManager,
  InMemoryLocationResolver,
  InMemoryResourceCalendar,
  InMemoryMaintenanceTracker,
  InMemoryQualityMetrics,
  FindCapableResourcesUseCase,
} from "@kernel/resource-kernel";
import type { CapableResource } from "@kernel/resource-kernel";
import {
  createInMemoryKnowledgeKernel,
} from "@kernel/knowledge-kernel";
import type {
  KnowledgeItem,
  Procedure,
  Regulation,
  Fact,
} from "@kernel/shared-kernel";
import {
  createInMemoryDomainModeling,
  defineDomain,
  defineEntityType,
  defineRelationship,
  defineStateMachine,
  transition,
  defineMeasurement,
  defineConstraint,
} from "@kernel/domain-modeling";
import type { DomainDefinition } from "@kernel/domain-modeling";

// ── Static catalogs (mirror docs/) ──────────────────────────────────────────

export interface ModuleInfo {
  readonly name: string;
  readonly layer: string;
  readonly dependsOn: string;
  readonly description: string;
}

export const KERNEL_MODULES: readonly ModuleInfo[] = [
  { name: "shared-kernel", layer: "Foundation", dependsOn: "—", description: "19 canonical primitives (frozen v1), branded IDs, Result/Option, value objects, RuntimeClock & RandomSource ports." },
  { name: "events", layer: "Foundation", dependsOn: "shared-kernel", description: "EventEnvelope, EventStore (optimistic concurrency), SnapshotStore, EventSourcedRepository." },
  { name: "observability", layer: "Foundation", dependsOn: "shared-kernel", description: "Tracer, Meter, Logger, AuditSink, ProvenanceRecorder ports + Noop/InMemory adapters." },
  { name: "config", layer: "Foundation", dependsOn: "shared-kernel", description: "ConfigSource, ConfigRegistry (precedence merge), Secrets ports + in-memory/env adapters." },
  { name: "runtime", layer: "Engine", dependsOn: "shared-kernel, events, observability, config", description: "RuntimeClock impls, SeededRandomSource, ExecutionContext, ExecutionGraph, DeterministicRuntimeExecutor." },
  { name: "identity", layer: "Context", dependsOn: "shared-kernel, events, observability", description: "User (event-sourced), Principal, Role, Permission, Credential, IdentityProvider & Authenticator ports." },
  { name: "organizations", layer: "Context", dependsOn: "shared-kernel, events, identity", description: "Organization, Tenant, Membership aggregates. Tenancy isolation boundary." },
  { name: "projections", layer: "Read side", dependsOn: "shared-kernel, events, runtime", description: "ProjectionDefinition, ProjectionEngine, ProjectionStore. Pure (event,state)→state read models." },
  { name: "policy", layer: "Governance", dependsOn: "shared-kernel, events, runtime", description: "PredicateSpec evaluator, PolicyDefinition, Rule, PolicyEngine, Decision with provenance." },
  { name: "scheduling", layer: "Foundation", dependsOn: "shared-kernel, events, runtime", description: "Schedule, ScheduleSlot, Scheduler PORT + NoopScheduler. No algorithm (ADR-0008)." },
  { name: "extension", layer: "Host", dependsOn: "shared-kernel", description: "Plugin, ExtensionHost, ExtensionRegistry, 9 registration contracts. Protocol host only (ADR-0006)." },
  { name: "compiler", layer: "Compiler", dependsOn: "shared-kernel, runtime, policy, scheduling, extension", description: "Intent → ExecutionGraph. 9-stage replaceable pipeline (ADR-0011). The ONLY component that creates work." },
  { name: "protocol-sdk", layer: "SDK", dependsOn: "@kernel/api/v1", description: "Protocol SDK: defineProtocol(), manifest validation, lifecycle manager, 14 contribution registries, DSL. Protocols describe, never execute (ADR-0012)." },
  { name: "application-runtime", layer: "Runtime", dependsOn: "@kernel/api/v1, protocol-sdk", description: "Application Runtime: installs branded, tenant-aware application instances of protocols. One protocol → many apps (ADR-0013)." },
  { name: "control-plane", layer: "Control", dependsOn: "@kernel/api/v1", description: "Platform Control Plane: read-only admin surface. Aggregates a PlatformSnapshot from all registries (ADR-0014)." },
  { name: "coordination", layer: "Coordination", dependsOn: "shared-kernel", description: "Coordination Kernel: matching/negotiation/reservation/commitment/assignment/queue/transfer/escalation engines. Marketplace is one strategy (ADR-0015)." },
  { name: "resource-kernel", layer: "Resource", dependsOn: "shared-kernel", description: "Resource Kernel: universal resource concepts — state, availability, capacity, location, calendar, skills, twin, maintenance, quality. Coordination queries it (ADR-0016)." },
  { name: "knowledge-kernel", layer: "Knowledge", dependsOn: "shared-kernel", description: "Knowledge Kernel: universal operational knowledge — SOPs, regulations, standards, facts, procedures, ontologies. Protocols register, kernel owns (ADR-0017)." },
  { name: "domain-modeling", layer: "Domain", dependsOn: "shared-kernel, knowledge-kernel", description: "Domain Modeling Framework: semantic layer — entity types, relationships, state machines, measurements, constraints. Domain ≠ Protocol (ADR-0018)." },
  { name: "api/v1", layer: "Surface", dependsOn: "all modules (facade)", description: "Frozen versioned public API (ADR-0009). Everything outside the kernel imports from here." },
];

export interface PrimitiveInfo {
  readonly name: string;
  readonly owner: string;
}

export const CANONICAL_PRIMITIVES: readonly PrimitiveInfo[] = [
  { name: "Intent", owner: "runtime" },
  { name: "Demand", owner: "runtime" },
  { name: "Task", owner: "runtime" },
  { name: "ExecutionPlan", owner: "runtime" },
  { name: "Execution", owner: "runtime" },
  { name: "Capability", owner: "runtime" },
  { name: "Resource", owner: "runtime" },
  { name: "Workflow", owner: "runtime" },
  { name: "Policy", owner: "policy" },
  { name: "Rule", owner: "policy" },
  { name: "Decision", owner: "policy" },
  { name: "Event", owner: "events" },
  { name: "Projection", owner: "projections" },
  { name: "Recommendation", owner: "runtime" },
  { name: "Route", owner: "scheduling" },
  { name: "Schedule", owner: "scheduling" },
  { name: "Simulation", owner: "runtime" },
  { name: "Observation", owner: "runtime" },
  { name: "Twin", owner: "runtime" },
];

// ── Demo result (plain serialisable data for rendering) ─────────────────────

export interface DemoEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly version: number;
  readonly timestamp: number;
  readonly streamId: string;
}

export interface DeterminismProof {
  readonly seed: number;
  readonly run1: readonly string[];
  readonly run2: readonly string[];
  readonly identical: boolean;
}

export interface DemoDecision {
  readonly decisionId: string;
  readonly outcome: string;
  readonly rationale: string;
  readonly matchedRules: readonly string[];
  readonly evaluatedAt: number;
  readonly inputHash: string | undefined;
  readonly sourceEventCount: number;
}

export interface DemoExtension {
  readonly plugins: readonly { id: string; version: string; name: string }[];
  readonly registrationKinds: readonly { kind: string; count: number }[];
}

export interface DemoCompilerStage {
  readonly name: string;
  readonly phase: string;
  readonly order: number;
  readonly ran: boolean;
  readonly durationMs?: number;
  readonly error?: string;
}

export interface DemoCompiler {
  readonly intentType: string;
  readonly ok: boolean;
  readonly stageCount: number;
  readonly stages: readonly DemoCompilerStage[];
  readonly graphId?: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly seed: number;
  readonly planId?: string;
  readonly taskCount: number;
  readonly diagnostics: readonly { severity: string; code: string; message: string; stage: string }[];
  readonly abortedReason?: string;
}

export interface DemoProtocolContribution {
  readonly kind: string;
  readonly count: number;
}

export interface DemoProtocolInfo {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly version: string;
  readonly state: ProtocolLifecycleState;
  readonly installedAt?: number;
  readonly contributions: readonly DemoProtocolContribution[];
  readonly validationErrors: number;
  readonly validationWarnings: number;
}

export interface DemoLifecycleEvent {
  readonly protocolId: string;
  readonly from: string;
  readonly to: string;
  readonly at: number;
  readonly reason?: string;
}

export interface DemoProtocolSdk {
  readonly protocols: readonly DemoProtocolInfo[];
  readonly lifecycleEvents: readonly DemoLifecycleEvent[];
  readonly capabilityCount: number;
  readonly intentTypeCount: number;
  readonly compilerExtensionCount: number;
}

export interface DemoApplicationInfo {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly status: ApplicationLifecycleState;
  readonly protocolId: string;
  readonly protocolVersion: string;
  readonly version: string;
  readonly organizationId: string;
  readonly tenantId: string;
  readonly primaryDomain?: string;
  readonly pathPrefix: string;
  readonly theme: { primary: string; accent: string; mode: string };
  readonly logoUrl?: string;
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly navigationCount: number;
  readonly localeCount: number;
  readonly authProviderCount: number;
  readonly uiExtensionCount: number;
  readonly configFieldCount: number;
  readonly versionHistoryCount: number;
  readonly validationErrors: number;
  readonly validationWarnings: number;
}

export interface DemoAppInstallStep {
  readonly step: string;
  readonly ok: boolean;
  readonly reason?: string;
}

export interface DemoAppRuntime {
  readonly applications: readonly DemoApplicationInfo[];
  readonly installSteps: readonly DemoAppInstallStep[];
  readonly installOk: boolean;
  readonly resolvedConfig: Readonly<Record<string, unknown>>;
  readonly resolvedNavigation: readonly { id: string; label: string; order: number }[];
  readonly resolvedAuthProviders: readonly string[];
  readonly resolvedDefaultLocale?: string;
}

export interface DemoPlatformSnapshot {
  readonly health: {
    readonly status: string;
    readonly kernelVersion: string;
    readonly apiVersion: string;
    readonly protocolCount: number;
    readonly applicationCount: number;
    readonly activeApplicationCount: number;
    readonly eventStorePosition: number;
    readonly projectionCount: number;
    readonly compilerStageCount: number;
    readonly checks: readonly { name: string; status: string; detail?: string }[];
  };
  readonly protocols: readonly DemoProtocolInfo[];
  readonly applications: readonly DemoApplicationInfo[];
  readonly organizations: readonly { id: string; name: string; status: string; tenantId: string; memberCount: number; applicationCount: number }[];
  readonly capabilities: readonly { id: string; capabilityType: string; ownerProtocolId: string; version: string; inputCount: number; outputCount: number; tags: readonly string[] }[];
  readonly intentTypes: readonly { intentType: string; ownerProtocolId: string; version: string; requiredCapabilityCount: number; compilerHookCount: number }[];
  readonly workflows: readonly { id: string; name: string; ownerProtocolId: string; stageCount: number; triggerIntentTypes: readonly string[] }[];
  readonly policies: readonly { id: string; name: string; ownerProtocolId: string; scope: string; effect: string; priority: number; ruleCount: number }[];
  readonly compilerExtensions: readonly { name: string; ownerProtocolId: string; phase: string; order: number; insertion: string }[];
  readonly observability: {
    readonly eventCount: number;
    readonly decisions: readonly unknown[];
    readonly metricPoints: readonly unknown[];
    readonly spanCount: number;
    readonly auditEvents: readonly unknown[];
  };
}

export interface DemoCoordinationStep {
  readonly step: string;
  readonly detail: string;
  readonly ok: boolean;
}

export interface DemoCoordination {
  readonly outcome: string;
  readonly steps: readonly DemoCoordinationStep[];
  readonly matchResourceId?: string;
  readonly matchScore?: number;
  readonly reservationId?: string;
  readonly commitmentId?: string;
  readonly assignmentId?: string;
  readonly assignmentStatus?: string;
  readonly candidateCount: number;
}

export interface DemoResourceInfo {
  readonly id: string;
  readonly resourceType: string;
  readonly displayName: string;
  readonly operationalState: string;
  readonly healthScore: number;
  readonly reliabilityScore: number;
  readonly location?: string;
  readonly certificationCount: number;
  readonly capacityMax: number;
  readonly capacityRemaining: number;
  readonly twinUpdatedAt: number;
  readonly matchScore?: number;
  readonly certified?: boolean;
  readonly confidence?: number;
}

export interface DemoResourceKernel {
  readonly resources: readonly DemoResourceInfo[];
  readonly capableResults: readonly DemoResourceInfo[];
  readonly queryCapabilityType: string;
}

export interface DemoKnowledgeItem {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly version: number;
  readonly status: string;
  readonly confidence: number;
  readonly tags: readonly string[];
  readonly evidenceCount: number;
  readonly ownerProtocolId?: string;
}

export interface DemoKnowledgeQuery {
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly matchedItems: number;
  readonly matchedProcedures: number;
  readonly matchedRegulations: number;
  readonly matchedFacts: number;
  readonly complianceCompliant: boolean;
  readonly complianceViolations: number;
}

export interface DemoKnowledgeKernel {
  readonly items: readonly DemoKnowledgeItem[];
  readonly query: DemoKnowledgeQuery;
}

export interface DemoEntityTypeInfo {
  readonly id: string;
  readonly name: string;
  readonly attributeCount: number;
  readonly relationshipCount: number;
  readonly twinEnabled: boolean;
  readonly hasStateMachine: boolean;
}

export interface DemoRelationshipInfo {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly source: string;
  readonly target: string;
  readonly cardinality: string;
}

export interface DemoDomainModeling {
  readonly domainId: string;
  readonly domainName: string;
  readonly version: number;
  readonly entityTypeCount: number;
  readonly relationshipCount: number;
  readonly stateMachineCount: number;
  readonly measurementCount: number;
  readonly constraintCount: number;
  readonly entityTypes: readonly DemoEntityTypeInfo[];
  readonly relationships: readonly DemoRelationshipInfo[];
}

export interface KernelDemoResult {
  readonly seed: number;
  readonly baseTime: number;
  readonly events: readonly DemoEvent[];
  readonly determinism: DeterminismProof;
  readonly projection: { readonly name: string; readonly state: Readonly<Record<string, number>> };
  readonly decision: DemoDecision;
  readonly extension: DemoExtension;
  readonly compiler: DemoCompiler;
  readonly protocolSdk: DemoProtocolSdk;
  readonly appRuntime: DemoAppRuntime;
  readonly platformSnapshot: DemoPlatformSnapshot;
  readonly coordination: DemoCoordination;
  readonly resourceKernel: DemoResourceKernel;
  readonly knowledgeKernel: DemoKnowledgeKernel;
  readonly domainModeling: DemoDomainModeling;
  readonly modules: readonly ModuleInfo[];
  readonly primitives: readonly PrimitiveInfo[];
}

// ── Runner ──────────────────────────────────────────────────────────────────

export async function runKernelDemo(): Promise<KernelDemoResult> {
  const SEED = 42;
  const BASE_TIME = 1700000000000;

  // ── 1. Event Sourcing (deterministic IDs via seeded RandomSource) ────────
  const random = new SeededRandomSource(SEED);
  const clock = new FixedRuntimeClock(BASE_TIME);
  const eventStore = new InMemoryEventStore({
    generateEventId: () => random.uuid(),
  });

  const streamId = aggregateStreamId("Organization", "org-demo-001");
  const eventTypes = ["OrganizationCreated", "MemberAdded", "MemberRoleGranted"];
  const inputs: EventInput[] = eventTypes.map((eventType, i) => ({
    aggregateId: "org-demo-001",
    aggregateType: "Organization",
    eventType,
    timestamp: clock.now() + i * 1000,
    metadata: {
      correlationId: "demo-correlation",
      tenantId: "tenant-demo",
      source: "kernel-demo",
    },
    payload: { sequence: i + 1 },
  }));

  const appendResult = await eventStore.append(streamId, inputs, ANY_VERSION);
  const envelopes: readonly EventEnvelope[] = appendResult.ok
    ? appendResult.value.appended
    : [];

  // ── 2. Determinism proof: fresh seed → identical UUID sequence ───────────
  const proofRandom = new SeededRandomSource(SEED);
  const run1 = envelopes.map((e) => e.eventId);
  const run2 = [proofRandom.uuid(), proofRandom.uuid(), proofRandom.uuid()];
  const identical = JSON.stringify(run1) === JSON.stringify(run2);

  // ── 3. CQRS read side: a PURE projection derives a read model ────────────
  const projectionStore = new InMemoryProjectionStore();
  const projectionEngine = new InMemoryProjectionEngine({
    store: projectionStore,
  });
  const eventCounter: ProjectionDefinition<Record<string, number>> = {
    id: asId<"ProjectionId">("demo.event-counter"),
    name: "Event Counter",
    sourceEventTypes: eventTypes,
    initialState: {},
    apply: (state, event) => ({
      ...state,
      [event.eventType]: (state[event.eventType] ?? 0) + 1,
    }),
  };
  projectionEngine.register(eventCounter);
  for (const e of envelopes) {
    await projectionEngine.handle(e, { correlationId: "demo-correlation" });
  }
  const readModel = await projectionStore.get<Record<string, number>>(
    eventCounter.id,
    "all"
  );
  const projectionState = readModel?.state ?? {};

  // ── 4. Policy: serializable PredicateSpec rule → Decision ────────────────
  const policyEngine = new InMemoryPolicyEngine();
  const denyLowPriority: PolicyDefinition = {
    id: asId<"PolicyId">("demo.deny-low-priority"),
    version: 1,
    name: "Deny Low-Priority Execution",
    scope: "global",
    priority: 100,
    effect: "deny",
    status: "active",
    rules: [
      {
        id: asId<"RuleId">("demo.rule.priority-lt-5"),
        name: "priority.level < 5",
        condition: { op: "lt", args: ["priority.level", 5] },
        effect: "deny",
        priority: 100,
        scope: "global",
      },
    ],
  };
  policyEngine.register(denyLowPriority);
  const decision = await policyEngine.evaluate(
    {
      subject: { kind: "task", id: "task-1", priority: { level: 3 } },
      action: "execute",
      principalId: null,
      tenantId: null,
      correlationId: "demo-correlation",
      inputs: { priorityLevel: 3 },
      sourceEventIds: envelopes.map((e) => e.eventId),
    },
    clock.now()
  );

  // ── 5. Extension host: a (fake) protocol plugin registers descriptors ───
  const registry = new InMemoryExtensionRegistry();
  const host = new DefaultExtensionHost(registry);
  const demoPlugin: Plugin = {
    manifest: {
      id: "opsos.protocol.demo",
      version: "0.1.0",
      name: "Demo Protocol",
      description: "Kernel self-test protocol (Milestone 1). Not a real protocol.",
      protocolId: "demo",
      dependencies: [],
      provides: ["demo.execute"],
    },
    register(h) {
      h.registerCapability({
        kind: "capability",
        extensionId: "opsos.protocol.demo",
        capability: {
          id: asId<"CapabilityId">("demo.cap.execute"),
          capabilityType: "demo.execute",
          providerId: asId<"ResourceId">("demo-resource-1"),
          parametersSchema: { ref: "demo.execute.params", version: 1 },
          constraints: [],
        },
      });
      h.registerIntentType({
        kind: "intent-type",
        extensionId: "opsos.protocol.demo",
        intentType: "demo.run",
        payloadSchema: { ref: "demo.run.payload", version: 1 },
        constraints: [],
      });
      h.registerAnalytics({
        kind: "analytics",
        extensionId: "opsos.protocol.demo",
        metricName: "demo.runs",
        sourceEventTypes: ["OrganizationCreated"],
        aggregation: "count",
      });
    },
  };
  await installPlugin(registry, host, demoPlugin);

  const registrationKinds: { kind: string; count: number }[] = [
    { kind: "capability", count: registry.capabilities().length },
    { kind: "intent-type", count: registry.intentTypes().length },
    { kind: "analytics", count: registry.analytics().length },
  ].filter((k) => k.count > 0);

  // ── 6. Compiler — Intent → 9-stage pipeline → ExecutionGraph ─────────────
  // ADR-0011: the compiler creates work; the runtime executes it.
  const compilerPolicyEngine = new InMemoryPolicyEngine();
  // An ALLOW policy so compilation proceeds past the policy-evaluator stage.
  compilerPolicyEngine.register({
    id: asId<"PolicyId">("compiler.allow-all"),
    version: 1,
    name: "Compiler Allow-All",
    scope: "global",
    priority: 1,
    effect: "allow",
    status: "active",
    rules: [
      {
        id: asId<"RuleId">("compiler.rule.allow"),
        name: "allow compilation",
        condition: { op: "exists", args: ["type"] },
        effect: "allow",
        priority: 1,
        scope: "global",
      },
    ],
  });

  const compilerClock = new FixedRuntimeClock(BASE_TIME + 10_000);
  const compilerRandom = new SeededRandomSource(SEED + 1);
  const compilerPipeline = new DefaultCompilerPipeline({
    stages: createDefaultStages({
      policyEvaluator: { engine: compilerPolicyEngine },
      scheduler: { scheduler: new NoopScheduler() },
    }),
  });

  const intent = {
    id: asId<"IntentId">("intent-demo-001"),
    type: "demo.run",
    principalId: asId<"PrincipalId">("principal-demo"),
    tenantId: asId<"TenantId">("tenant-demo"),
    payload: { target: "self-test", iterations: 1 },
    priority: { level: 5, label: "normal" },
    constraints: [
      {
        kind: "temporal-window",
        params: { start: BASE_TIME + 20_000, end: BASE_TIME + 86_400_000, timezone: "UTC" },
      },
    ],
    status: "declared" as const,
    createdAt: compilerClock.now(),
    updatedAt: compilerClock.now(),
  };

  const compileCtx: CompilationContext = createCompilationContext(intent, {
    clock: compilerClock,
    random: compilerRandom,
    principalId: intent.principalId,
    tenantId: intent.tenantId,
    correlationId: "compile-demo",
    registry,
  });

  const compileResult = await compilerPipeline.compile(intent, compileCtx);

  const compilerDemo: DemoCompiler = {
    intentType: intent.type,
    ok: compileResult.ok,
    stageCount: compileResult.stages.length,
    stages: compileResult.stages.map((s) => ({
      name: s.name,
      phase: s.phase,
      order: s.order,
      ran: s.ran,
      durationMs: s.durationMs,
      error: s.error,
    })),
    graphId: compileResult.graph?.id,
    nodeCount: compileResult.graph?.nodes.length ?? 0,
    edgeCount: compileResult.graph?.edges.length ?? 0,
    seed: compileResult.graph?.seed ?? 0,
    planId: compileResult.plan?.id,
    taskCount: compileResult.plan?.tasks.length ?? 0,
    diagnostics: compileResult.diagnostics.map((d) => ({
      severity: d.severity,
      code: d.code,
      message: d.message,
      stage: d.stage,
    })),
    abortedReason: compileResult.aborted?.reason,
  };

  // ── 7. Protocol SDK — install the Demo Protocol through its lifecycle ────
  // ADR-0012: protocols describe work; they never execute it.
  const protocolRegistry = new ProtocolRegistry();
  const sdkClock = new FixedRuntimeClock(BASE_TIME + 20_000);
  const lifecycleManager = new DefaultLifecycleManager({
    registry: protocolRegistry,
    clock: sdkClock,
    registerProtocol: (manifest, host) => {
      // Run the Demo Protocol's register(host) callback.
      demoProtocol.register(host);
    },
  });

  // Full lifecycle: discover → validate → install → enable
  const d1 = lifecycleManager.discover(demoProtocol.manifest);
  const d2 = d1.ok ? lifecycleManager.validate(demoProtocol.manifest.id) : d1;
  const d3 = d2.ok ? lifecycleManager.install(demoProtocol.manifest.id) : d2;
  const d4 = d3.ok ? lifecycleManager.enable(demoProtocol.manifest.id) : d3;

  // Validate the manifest for diagnostics display.
  const { validateProtocolManifest } = await import("@kernel/protocol-sdk");
  const { KERNEL_VERSION } = await import("@kernel/protocol-sdk");
  const manifestDiags = validateProtocolManifest(demoProtocol.manifest, KERNEL_VERSION);

  const tracked = lifecycleManager.list();
  const contributionCounts = protocolRegistry.contributionCounts(demoProtocol.manifest.id);

  const protocolSdkDemo: DemoProtocolSdk = {
    protocols: tracked.map((p) => ({
      id: p.manifest.id,
      name: p.manifest.name,
      displayName: p.manifest.displayName,
      version: p.manifest.version,
      state: p.state,
      installedAt: p.installedAt,
      contributions: Object.entries(contributionCounts)
        .filter(([, n]) => n > 0)
        .map(([kind, count]) => ({ kind, count })),
      validationErrors: manifestDiags.filter((d) => d.severity === "error").length,
      validationWarnings: manifestDiags.filter((d) => d.severity === "warn").length,
    })),
    lifecycleEvents: lifecycleManager.events().map((e) => ({
      protocolId: e.protocolId,
      from: e.from,
      to: e.to,
      at: e.at,
      reason: e.reason,
    })),
    capabilityCount: protocolRegistry.capabilities.list().length,
    intentTypeCount: protocolRegistry.intents.list().length,
    compilerExtensionCount: protocolRegistry.compilerExtensions.list().length,
  };

  // ── 8. Application Runtime — install Eks-Clean Demo (powered by Demo Protocol)
  // ADR-0013: one protocol → many branded applications. No duplicated logic.
  const appRegistry = new InMemoryApplicationRegistry();
  const appClock = new FixedRuntimeClock(BASE_TIME + 30_000);
  const appLifecycle = new DefaultApplicationLifecycleManager({
    registry: appRegistry,
    clock: appClock,
    getInstalledProtocolVersion: (protocolId: string) => {
      // The Demo Protocol is installed at version 1.0.0 (from step 7).
      if (protocolId === demoProtocol.manifest.id) return demoProtocol.manifest.version;
      return undefined;
    },
  });

  const installResult = await installApplication(
    { lifecycle: appLifecycle, getInstalledProtocolVersion: (id) => (id === demoProtocol.manifest.id ? demoProtocol.manifest.version : undefined) },
    eksCleanDemoApplication
  );

  // Resolve the installed application's runtime views (branding, config, features, nav, auth, i18n).
  const installedApp = appRegistry.get(eksCleanDemoApplication.id);
  let appRuntimeDemo: DemoAppRuntime;
  if (installedApp) {
    const manifest = installedApp.manifest;
    const branding = resolveBranding(manifest.branding);
    const config = resolveConfiguration(manifest.configurationSchema, manifest.configuration);
    const flags = resolveFeatureFlags(manifest.featureFlags);
    const nav = resolveNavigation(manifest.navigation, { featureFlags: flags });
    const auth = resolveAuthentication(manifest.authentication);
    const l10n = resolveLocalization(manifest.localization);
    const routing = resolveRouting(manifest.id, manifest.routing);

    const { validateApplicationManifest } = await import("@kernel/application-runtime");
    const appDiags = validateApplicationManifest(manifest, demoProtocol.manifest.version);

    appRuntimeDemo = {
      applications: [{
        id: manifest.id,
        name: manifest.name,
        displayName: manifest.displayName,
        status: installedApp.status,
        protocolId: manifest.protocolId,
        protocolVersion: manifest.protocolVersion,
        version: manifest.version,
        organizationId: String(manifest.organizationId),
        tenantId: String(manifest.tenantId),
        primaryDomain: routing.primaryDomain,
        pathPrefix: manifest.routing.pathPrefix,
        theme: { primary: branding.theme.primary, accent: branding.theme.accent, mode: branding.theme.mode },
        logoUrl: branding.logoUrl,
        featureFlags: flags.values,
        navigationCount: nav.length,
        localeCount: l10n.supportedLocales.length,
        authProviderCount: auth.enabledProviders.length,
        uiExtensionCount: manifest.uiExtensions.filter((u) => u.enabled).length,
        configFieldCount: manifest.configurationSchema.fields.length,
        versionHistoryCount: installedApp.versionHistory.length,
        validationErrors: appDiags.filter((d) => d.severity === "error").length,
        validationWarnings: appDiags.filter((d) => d.severity === "warn").length,
      }],
      installSteps: installResult.steps,
      installOk: installResult.ok,
      resolvedConfig: config.values,
      resolvedNavigation: nav.map((n) => ({ id: n.id, label: n.label, order: n.order })),
      resolvedAuthProviders: auth.enabledProviders.map((p) => p.providerId),
      resolvedDefaultLocale: l10n.defaultLocale,
    };
  } else {
    appRuntimeDemo = {
      applications: [],
      installSteps: installResult.steps,
      installOk: false,
      resolvedConfig: {},
      resolvedNavigation: [],
      resolvedAuthProviders: [],
    };
  }

  // ── 9. Platform Control Plane — aggregate a full snapshot ────────────────
  // ADR-0014: read-only admin surface. Aggregates from all registries.
  const platformSnapshot: DemoPlatformSnapshot = {
    health: {
      status: "healthy",
      kernelVersion: "1.3.0",
      apiVersion: "1.0.0",
      protocolCount: protocolSdkDemo.protocols.length,
      applicationCount: appRuntimeDemo.applications.length,
      activeApplicationCount: appRuntimeDemo.applications.filter((a) => a.status === "active").length,
      eventStorePosition: eventStore.globalPosition(),
      projectionCount: 1,
      compilerStageCount: 9 + protocolRegistry.compilerExtensions.list().length,
      checks: [
        { name: "event-store", status: "healthy", detail: `${eventStore.globalPosition()} events` },
        { name: "protocols", status: "healthy", detail: `${protocolSdkDemo.protocols.length} installed` },
        { name: "applications", status: "healthy", detail: `${appRuntimeDemo.applications.filter((a) => a.status === "active").length} active` },
        { name: "projections", status: "healthy", detail: "1 registered" },
        { name: "compiler", status: "healthy", detail: `${9 + protocolRegistry.compilerExtensions.list().length} stages` },
      ],
    },
    protocols: protocolSdkDemo.protocols,
    applications: appRuntimeDemo.applications,
    organizations: appRuntimeDemo.applications.map((a) => ({
      id: a.organizationId,
      name: a.organizationId,
      status: "active",
      tenantId: a.tenantId,
      memberCount: 0,
      applicationCount: 1,
    })),
    capabilities: protocolRegistry.capabilities.list().map((c) => ({
      id: String(c.id),
      capabilityType: c.capabilityType,
      ownerProtocolId: c.ownerProtocolId,
      version: c.version,
      inputCount: c.inputs.length,
      outputCount: c.outputs.length,
      tags: c.tags,
    })),
    intentTypes: protocolRegistry.intents.list().map((i) => ({
      intentType: i.intentType,
      ownerProtocolId: i.ownerProtocolId,
      version: i.version,
      requiredCapabilityCount: i.requiredCapabilities.length,
      compilerHookCount: i.compilerHooks.length,
    })),
    workflows: protocolRegistry.workflows.list().map((w) => ({
      id: w.id,
      name: w.name,
      ownerProtocolId: w.ownerProtocolId,
      stageCount: w.stages.length,
      triggerIntentTypes: w.triggerIntentTypes,
    })),
    policies: protocolRegistry.policy.listPolicies().map((p) => ({
      id: String(p.id),
      name: p.name,
      ownerProtocolId: p.ownerProtocolId,
      scope: p.scope,
      effect: p.effect,
      priority: p.priority,
      ruleCount: p.ruleIds.length,
    })),
    compilerExtensions: protocolRegistry.compilerExtensions.list().map((s) => ({
      name: s.name,
      ownerProtocolId: s.ownerProtocolId,
      phase: s.phase,
      order: s.order,
      insertion: s.insertion,
    })),
    observability: {
      eventCount: eventStore.globalPosition(),
      decisions: [],
      metricPoints: [],
      spanCount: 0,
      auditEvents: [],
    },
  };

  // ── 10. Coordination Kernel — Demo Exchange ──────────────────────────────
  // ADR-0015: universal coordination. Demand A → Capability X → Resource R →
  // Assignment → Acceptance → Completion. No industry terms.
  const coordClock = new FixedRuntimeClock(BASE_TIME + 40_000);
  const matchingEngine = new InMemoryMatchingEngine();
  const reservationEngine = new InMemoryReservationEngine();
  const commitmentEngine = new InMemoryCommitmentEngine();
  const assignmentEngine = new InMemoryAssignmentEngine();
  const coordinateWork = new CoordinateWorkUseCase(
    matchingEngine, reservationEngine, commitmentEngine, assignmentEngine
  );

  const demoDemand = {
    id: asId<"DemandId">("demand-A"),
    intentId: asId<"IntentId">("intent-coord-demo"),
    resourceType: "generic.execute",
    quantity: { amount: 1, unit: "task" },
    constraints: [],
    temporalWindow: { start: coordClock.now(), end: coordClock.now() + 86_400_000, timezone: "UTC" },
    priority: { level: 5, label: "normal" },
  };
  const demoResource = {
    id: asId<"ResourceId">("resource-R"),
    resourceType: "generic",
    capabilities: [asId<"CapabilityId">("cap-X")],
    attributes: {},
    availability: { windows: [], exclusions: [] },
    capacity: { max: 10, unit: "task" },
    tenantId: asId<"TenantId">("tenant-demo"),
  };
  const demoCapability = {
    id: asId<"CapabilityId">("cap-X"),
    capabilityType: "generic.execute",
    providerId: asId<"ResourceId">("resource-R"),
    parametersSchema: { ref: "generic.execute.params", version: 1 },
    constraints: [],
  };

  const coordResult: CoordinateWorkResult = coordinateWork.execute({
    demand: demoDemand,
    resources: [demoResource],
    capabilities: [demoCapability],
    matchPolicies: [],
    taskId: asId<"TaskId">("task-coord-1"),
    tenantId: asId<"TenantId">("tenant-demo"),
    reservationTtlMs: 60_000,
    correlationId: "coord-demo",
    provenance: { sourceEventIds: [] },
    now: coordClock.now(),
  });

  // Accept the assignment (simulating the resource accepting the work).
  let acceptedAssignment;
  if (coordResult.assignment) {
    acceptedAssignment = assignmentEngine.accept(coordResult.assignment, coordClock.now());
  }

  const coordinationDemo: DemoCoordination = {
    outcome: coordResult.outcome,
    steps: coordResult.diagnostics.map((d, i) => ({
      step: ["match", "reserve", "commit", "assign"][i] ?? `step-${i}`,
      detail: d,
      ok: true,
    })).concat(acceptedAssignment ? [{ step: "accept", detail: `assignment ${acceptedAssignment.id} → accepted`, ok: true }] : []),
    matchResourceId: coordResult.match?.resourceId ? String(coordResult.match.resourceId) : undefined,
    matchScore: coordResult.match?.score,
    reservationId: coordResult.reservation?.id ? String(coordResult.reservation.id) : undefined,
    commitmentId: coordResult.commitment?.id ? String(coordResult.commitment.id) : undefined,
    assignmentId: acceptedAssignment?.id ? String(acceptedAssignment.id) : undefined,
    assignmentStatus: acceptedAssignment?.status,
    candidateCount: coordResult.matchResult.candidates.length,
  };

  // ── 11. Resource Kernel — register resources + query "capable of X" ──────
  // ADR-0016: the coordination kernel queries the resource kernel.
  const resourceRegistry = new InMemoryResourceRegistry();
  const availabilityEngine = new InMemoryAvailabilityEngine();
  const capacityTracker = new InMemoryCapacityTracker();
  const skillRegistry = new InMemorySkillRegistry();
  const twinManager = new InMemoryTwinManager();
  const locationResolver = new InMemoryLocationResolver();
  const calendar = new InMemoryResourceCalendar();
  const maintenance = new InMemoryMaintenanceTracker();
  const quality = new InMemoryQualityMetrics();

  // Register a location.
  const demoLocation = {
    id: asId<"LocationId">("loc-zone-A"),
    kind: "zone" as const,
    label: "Zone A",
    attributes: {},
  };
  locationResolver.register(demoLocation);

  // Register two resources — one capable + certified, one not.
  const resR1 = asId<"ResourceId">("resource-R1");
  const resR2 = asId<"ResourceId">("resource-R2");

  for (const rid of [resR1, resR2]) {
    const isPrimary = rid === resR1;
    const record = {
      id: rid,
      resourceType: "generic",
      tenantId: asId<"TenantId">("tenant-demo"),
      displayName: isPrimary ? "Resource R1 (primary)" : "Resource R2 (backup)",
      capabilities: [asId<"CapabilityId">("cap-X")],
      location: isPrimary ? demoLocation : undefined,
      certifications: [],
      health: {
        resourceId: rid,
        operationalState: "idle" as const,
        maintenanceStatus: "none" as const,
        healthScore: isPrimary ? 0.95 : 0.80,
        reliabilityScore: isPrimary ? 0.98 : 0.85,
        lastKnownAt: coordClock.now(),
        issues: [],
      },
      twin: {
        id: asId<"TwinId">(`twin:${rid}`),
        resourceId: rid,
        modelType: "generic",
        state: { status: isPrimary ? "ready" : "standby" },
        updatedAt: coordClock.now(),
        fidelity: isPrimary ? 0.9 : 0.7,
        assumptions: [],
      },
      costModel: { model: "free" },
      qualityMetrics: {},
      attributes: {},
    };
    resourceRegistry.register(record);
    availabilityEngine.setState(rid, "idle", coordClock.now());
    capacityTracker.setCapacity(rid, isPrimary ? 10 : 5, "task");
    twinManager.updateState(rid, { status: isPrimary ? "ready" : "standby" }, coordClock.now());
    quality.recordOutcome(rid, true, coordClock.now());
    quality.recordOutcome(rid, true, coordClock.now());
  }

  // Certify R1 for the capability.
  skillRegistry.registerCertification({
    id: asId<"CertificationId">("cert-R1-cap-X"),
    resourceId: resR1,
    capabilityId: asId<"CapabilityId">("cap-X"),
    capabilityType: "generic.execute",
    level: 3,
    issuer: "opsos-demo",
    issuedAt: coordClock.now(),
    status: "active",
    confidence: 0.92,
    evidence: {},
  });

  // Query: "give me resources capable of generic.execute"
  const findCapable = new FindCapableResourcesUseCase(
    resourceRegistry, availabilityEngine, capacityTracker, skillRegistry
  );
  const capableResults = findCapable.execute({
    request: {
      capabilityType: "generic.execute",
      quantity: { amount: 1, unit: "task" },
      window: { start: coordClock.now(), end: coordClock.now() + 86_400_000, timezone: "UTC" },
      constraints: [],
      now: coordClock.now(),
    },
  });

  const allResources = resourceRegistry.list().map((r) => {
    const capable = capableResults.find((c) => c.resource.id === r.id);
    const cap = capacityTracker.getCapacity(r.id);
    return {
      id: String(r.id),
      resourceType: r.resourceType,
      displayName: r.displayName,
      operationalState: r.health.operationalState,
      healthScore: r.health.healthScore,
      reliabilityScore: r.health.reliabilityScore,
      location: r.location?.label,
      certificationCount: skillRegistry.getCertifications(r.id).length,
      capacityMax: cap?.max ?? 0,
      capacityRemaining: cap?.remaining ?? 0,
      twinUpdatedAt: r.twin.updatedAt,
      matchScore: capable?.matchScore,
      certified: capable?.certified,
      confidence: capable?.confidence,
    };
  });

  const resourceKernelDemo: DemoResourceKernel = {
    resources: allResources,
    capableResults: capableResults.map((c) => ({
      id: String(c.resource.id),
      resourceType: c.resource.resourceType,
      displayName: c.resource.displayName,
      operationalState: c.resource.health.operationalState,
      healthScore: c.resource.health.healthScore,
      reliabilityScore: c.resource.health.reliabilityScore,
      location: c.resource.location?.label,
      certificationCount: skillRegistry.getCertifications(c.resource.id).length,
      capacityMax: c.remainingCapacity,
      capacityRemaining: c.remainingCapacity,
      twinUpdatedAt: c.resource.twin.updatedAt,
      matchScore: c.matchScore,
      certified: c.certified,
      confidence: c.confidence,
    })),
    queryCapabilityType: "generic.execute",
  };

  // ── 12. Knowledge Kernel — register knowledge + query "what applies?" ───
  // ADR-0017: protocols register knowledge; kernel owns storage/query.
  const kk = createInMemoryKnowledgeKernel();
  const kkNow = coordClock.now();

  // Register a source.
  const demoSource = {
    id: asId<"SourceId">("source-demo-sop"),
    type: "sop" as const,
    title: "Demo Standard Operating Procedure",
    issuer: "OpsOS Demo",
    version: "1.0",
    publishedAt: kkNow,
    effectiveAt: kkNow,
  };
  kk.sources.register(demoSource);

  // Register a knowledge item (procedure) — generic, no industry terms.
  const procItemId = asId<"KnowledgeItemId">("ki-proc-generic-execute");
  const procKnowledgeItem: KnowledgeItem = {
    id: procItemId,
    kind: "procedure",
    tenantId: asId<"TenantId">("tenant-demo"),
    title: "Generic Execution Procedure",
    description: "A generic SOP for executing a task — no industry-specific content.",
    version: 1,
    status: "active",
    applicability: {
      subjectKind: "resource",
      subjectId: "resource-R1",
      conditions: [],
      tags: ["generic", "execution"],
    },
    evidence: [
      {
        id: asId<"EvidenceId">("ev-proc-1"),
        sourceId: demoSource.id,
        type: "document",
        description: "Demo SOP document",
        reference: "demo-sop.pdf",
        confidence: 0.95,
      },
    ],
    confidence: 0.92,
    provenance: { sourceEventIds: [] },
    ownerProtocolId: "opsos.protocol.demo",
    createdAt: kkNow,
    updatedAt: kkNow,
    metadata: {},
  };
  kk.registry.register(procKnowledgeItem);

  const demoProcedure: Procedure = {
    id: asId<"ProcedureId">("proc-generic-execute"),
    knowledgeItemId: procItemId,
    steps: [
      { id: "step-1", order: 10, title: "Prepare", materials: [], hazards: [], qualityChecks: ["verify-readiness"], constraints: [] },
      { id: "step-2", order: 20, title: "Execute", materials: [], hazards: [], qualityChecks: ["verify-execution"], constraints: [] },
      { id: "step-3", order: 30, title: "Verify", materials: [], hazards: [], qualityChecks: ["verify-quality"], constraints: [] },
    ],
    requiredMaterials: [],
    hazards: [],
    qualityChecks: ["verify-readiness", "verify-execution", "verify-quality"],
  };
  kk.procedures.register(demoProcedure);

  // Register a regulation (generic).
  const regItemId = asId<"KnowledgeItemId">("ki-reg-generic-compliance");
  kk.registry.register({
    id: regItemId,
    kind: "regulation",
    tenantId: asId<"TenantId">("tenant-demo"),
    title: "Generic Compliance Regulation",
    description: "A generic regulation requiring compliance verification.",
    version: 1,
    status: "active",
    applicability: { subjectKind: "resource", subjectId: "resource-R1", conditions: [], tags: ["compliance"] },
    evidence: [],
    confidence: 1.0,
    provenance: { sourceEventIds: [] },
    createdAt: kkNow,
    updatedAt: kkNow,
    metadata: {},
  });
  kk.regulations.register({
    id: asId<"RegulationId">("reg-generic-001"),
    knowledgeItemId: regItemId,
    jurisdiction: "global",
    severity: "mandatory",
    code: "GEN-001",
    requirements: ["Verify resource capability before assignment", "Record execution evidence"],
  });

  // Register a fact (generic).
  const factItemId = asId<"KnowledgeItemId">("ki-fact-generic");
  kk.registry.register({
    id: factItemId,
    kind: "fact",
    tenantId: asId<"TenantId">("tenant-demo"),
    title: "Generic Resource Capability Fact",
    version: 1,
    status: "active",
    applicability: { subjectKind: "resource", subjectId: "resource-R1", conditions: [], tags: ["capability"] },
    evidence: [],
    confidence: 0.88,
    provenance: { sourceEventIds: [] },
    createdAt: kkNow,
    updatedAt: kkNow,
    metadata: {},
  });
  kk.facts.register({
    id: asId<"FactId">("fact-generic-001"),
    knowledgeItemId: factItemId,
    subject: { kind: "resource", id: "resource-R1" },
    predicate: "supports-capability",
    object: { capabilityType: "generic.execute" },
    confidence: 0.88,
  });

  // Query: "what knowledge applies to resource-R1?"
  const lookupResult = kk.engine.lookup("resource", "resource-R1", undefined, kkNow);
  const procedures = kk.engine.lookupProcedures("resource", "resource-R1", kkNow);
  const regulations = kk.engine.lookupRegulations("resource", "resource-R1", undefined, kkNow);
  const facts = kk.engine.lookupFacts("resource", "resource-R1", kkNow);
  const compliance = kk.engine.checkCompliance("resource", "resource-R1", "global", kkNow);

  const knowledgeKernelDemo: DemoKnowledgeKernel = {
    items: kk.registry.list().map((ki) => ({
      id: String(ki.id),
      kind: ki.kind,
      title: ki.title,
      version: ki.version,
      status: ki.status,
      confidence: ki.confidence,
      tags: ki.applicability.tags,
      evidenceCount: ki.evidence.length,
      ownerProtocolId: ki.ownerProtocolId,
    })),
    query: {
      subjectKind: "resource",
      subjectId: "resource-R1",
      matchedItems: lookupResult.length,
      matchedProcedures: procedures.length,
      matchedRegulations: regulations.length,
      matchedFacts: facts.length,
      complianceCompliant: compliance.compliant,
      complianceViolations: compliance.violations.length,
    },
  };

  // ── 13. Domain Modeling Framework — Generic Operations Domain ────────────
  // ADR-0018: domain definition (semantics) ≠ protocol (behavior).
  // Asset contains Area; Work Unit requires Capability. No industry terms.
  const dm = createInMemoryDomainModeling();

  const assetType = defineEntityType({
    id: "asset",
    name: "Asset",
    displayName: "Asset",
    attributes: [
      { name: "label", type: "string", required: true },
      { name: "value", type: "number", required: false },
    ],
    relationships: ["asset-contains-area"],
    stateMachineId: "asset-lifecycle",
    twinEnabled: true,
    resourceBindings: [],
    description: "A generic operational asset that contains areas.",
  });

  const areaType = defineEntityType({
    id: "area",
    name: "Area",
    displayName: "Area",
    attributes: [
      { name: "label", type: "string", required: true },
      { name: "size", type: "measurement", required: false, measurementMetric: "area" },
    ],
    relationships: [],
    twinEnabled: true,
    resourceBindings: [],
    description: "A sub-region within an asset.",
  });

  const workUnitType = defineEntityType({
    id: "work-unit",
    name: "WorkUnit",
    displayName: "Work Unit",
    attributes: [
      { name: "title", type: "string", required: true },
      { name: "priority", type: "number", required: false, default: 0 },
    ],
    relationships: ["work-unit-requires-capability"],
    stateMachineId: "work-unit-lifecycle",
    twinEnabled: false,
    resourceBindings: [{ resourceType: "generic", capabilityType: "generic.execute" }],
    description: "A unit of work that requires a capability.",
  });

  const assetLifecycle = defineStateMachine({
    id: "asset-lifecycle",
    name: "Asset Lifecycle",
    states: ["draft", "active", "decommissioned"],
    transitions: [
      transition("draft", "active"),
      transition("active", "decommissioned"),
    ],
    initial: "draft",
    terminal: ["decommissioned"],
  });

  const workUnitLifecycle = defineStateMachine({
    id: "work-unit-lifecycle",
    name: "Work Unit Lifecycle",
    states: ["pending", "scheduled", "executing", "completed", "cancelled"],
    transitions: [
      transition("pending", "scheduled"),
      transition("scheduled", "executing"),
      transition("executing", "completed"),
      transition("pending", "cancelled"),
      transition("scheduled", "cancelled"),
    ],
    initial: "pending",
    terminal: ["completed", "cancelled"],
  });

  const assetContainsArea = defineRelationship({
    id: "asset-contains-area",
    name: "contains",
    sourceEntityType: "asset",
    targetEntityType: "area",
    kind: "contains",
    cardinality: "one-to-many",
    bidirectional: false,
    inverseName: "contained_by",
  });

  const workUnitRequiresCapability = defineRelationship({
    id: "work-unit-requires-capability",
    name: "requires",
    sourceEntityType: "work-unit",
    targetEntityType: "asset",
    kind: "requires",
    cardinality: "many-to-many",
    bidirectional: false,
  });

  const areaMeasurement = defineMeasurement({
    metric: "area",
    unit: "m²",
    valueType: "number",
    min: 0,
  });

  const workUnitMustHaveTitle = defineConstraint({
    id: "work-unit-must-have-title",
    kind: "must_have",
    targetEntityType: "work-unit",
    attributeRef: "title",
    params: {},
  });

  const genericOpsDomain: DomainDefinition = defineDomain({
    id: "opsos.domain.generic-operations",
    name: "generic-operations",
    version: 1,
    displayName: "Generic Operations Domain",
    description: "A domain definition proving the framework — Asset contains Area, Work Unit requires Capability. No industry terms.",
    entityTypes: [assetType, areaType, workUnitType],
    relationships: [assetContainsArea, workUnitRequiresCapability],
    stateMachines: [assetLifecycle, workUnitLifecycle],
    measurements: [areaMeasurement],
    constraints: [workUnitMustHaveTitle],
  });

  dm.registerDomain(genericOpsDomain);

  const domainModelingDemo: DemoDomainModeling = {
    domainId: genericOpsDomain.id,
    domainName: genericOpsDomain.name,
    version: genericOpsDomain.version,
    entityTypeCount: genericOpsDomain.entityTypes.length,
    relationshipCount: genericOpsDomain.relationships.length,
    stateMachineCount: genericOpsDomain.stateMachines.length,
    measurementCount: genericOpsDomain.measurements.length,
    constraintCount: genericOpsDomain.constraints.length,
    entityTypes: genericOpsDomain.entityTypes.map((et) => ({
      id: et.id,
      name: et.name,
      attributeCount: et.attributes.length,
      relationshipCount: et.relationships.length,
      twinEnabled: et.twinEnabled,
      hasStateMachine: !!et.stateMachineId,
    })),
    relationships: genericOpsDomain.relationships.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      source: r.sourceEntityType,
      target: r.targetEntityType,
      cardinality: r.cardinality,
    })),
  };

  return {
    seed: SEED,
    baseTime: BASE_TIME,
    events: envelopes.map((e) => ({
      eventId: e.eventId,
      eventType: e.eventType,
      version: e.version,
      timestamp: e.timestamp,
      streamId: e.streamId,
    })),
    determinism: { seed: SEED, run1, run2, identical },
    projection: { name: eventCounter.name, state: projectionState },
    decision: {
      decisionId: decision.id,
      outcome: decision.outcome,
      rationale: decision.rationale,
      matchedRules: decision.matchedRules.map(String),
      evaluatedAt: decision.evaluatedAt,
      inputHash: decision.provenance.inputHash,
      sourceEventCount: decision.provenance.sourceEventIds.length,
    },
    extension: {
      plugins: registry.listPlugins().map((p) => ({
        id: p.manifest.id,
        version: p.manifest.version,
        name: p.manifest.name,
      })),
      registrationKinds,
    },
    compiler: compilerDemo,
    protocolSdk: protocolSdkDemo,
    appRuntime: appRuntimeDemo,
    platformSnapshot,
    coordination: coordinationDemo,
    resourceKernel: resourceKernelDemo,
    knowledgeKernel: knowledgeKernelDemo,
    domainModeling: domainModelingDemo,
    modules: KERNEL_MODULES,
    primitives: CANONICAL_PRIMITIVES,
  };
}
