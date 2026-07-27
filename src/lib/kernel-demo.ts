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

export interface KernelDemoResult {
  readonly seed: number;
  readonly baseTime: number;
  readonly events: readonly DemoEvent[];
  readonly determinism: DeterminismProof;
  readonly projection: { readonly name: string; readonly state: Readonly<Record<string, number>> };
  readonly decision: DemoDecision;
  readonly extension: DemoExtension;
  readonly compiler: DemoCompiler;
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
    modules: KERNEL_MODULES,
    primitives: CANONICAL_PRIMITIVES,
  };
}
