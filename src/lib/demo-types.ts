/**
 * Standalone demo types — NO kernel imports.
 * This file severs the web app from the kernel module graph,
 * preventing Turbopack OOM during compilation.
 */

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
  { name: "composition", layer: "Packaging", dependsOn: "shared-kernel, protocol-sdk, domain-modeling", description: "Composition & Operational Package System: turns protocol source into immutable .opspkg. Apps install packages (ADR-0019)." },
  { name: "conformance", layer: "Conformance", dependsOn: "shared-kernel", description: "Kernel Conformance & Simulation Framework: 25 generic scenarios validating kernel neutrality. Every protocol must pass (ADR-0020)." },
  { name: "intelligence", layer: "Intelligence", dependsOn: "shared-kernel", description: "Operational Intelligence Framework: observes, explains, predicts, recommends. Never performs work. AI providers implement contracts (ADR-0021)." },
  { name: "governance", layer: "Governance", dependsOn: "shared-kernel", description: "Platform Governance & Evolution: version compatibility, migration, lifecycle, certification, policies. Governs how the platform evolves (ADR-0022)." },
  { name: "ai-workforce", layer: "Platform", dependsOn: "shared-kernel", description: "AI Workforce Runtime: AI Org, Roles, Teams, Director, Agent lifecycle/memory/collaboration/handoffs, Human approval, Autonomous boundaries (M14)." },
  { name: "communication", layer: "Platform", dependsOn: "shared-kernel", description: "Communication Runtime: notifications, email, SMS, push, WhatsApp, voice, webhooks. Protocols publish events; platform decides delivery (M15)." },
  { name: "workflow-runtime", layer: "Platform", dependsOn: "shared-kernel", description: "Workflow Runtime: BPMN-like execution, waiting, retries, timers, approvals, compensation, saga, recurring jobs (M16)." },
  { name: "integration-hub", layer: "Platform", dependsOn: "shared-kernel", description: "Integration Hub: universal connectors — calendars, payments (PaySwap only), maps, identity, ERP, CRM, IoT, AI (M17)." },
  { name: "twin-runtime", layer: "Platform", dependsOn: "shared-kernel", description: "Digital Twin Runtime: current/historical/predicted/simulated state, live telemetry, health, recommendations (M18)." },
  { name: "experience-runtime", layer: "Platform", dependsOn: "shared-kernel", description: "Experience Runtime: Intent, Journey, Session, Context, Narrative, Guidance, Milestones, Goals. Apps expose experiences (M19)." },
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
  readonly state: string;
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
  readonly status: string;
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

export interface DemoPackageStage {
  readonly stage: string;
  readonly ok: boolean;
  readonly durationMs?: number;
}

export interface DemoComposition {
  readonly packageId: string;
  readonly version: string;
  readonly compiled: boolean;
  readonly stages: readonly DemoPackageStage[];
  readonly digest: string;
  readonly signed: boolean;
  readonly installed: boolean;
  readonly activated: boolean;
  readonly lifecycleEvents: readonly { from: string; to: string }[];
  readonly contentCounts: { readonly kind: string; readonly count: number }[];
}

export interface DemoScenarioResult {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly passed: boolean;
  readonly assertionsPassed: number;
  readonly assertionsTotal: number;
  readonly replayVerified: boolean;
  readonly eventCount: number;
  readonly durationMs: number;
}

export interface DemoConformance {
  readonly totalScenarios: number;
  readonly passed: number;
  readonly failed: number;
  readonly deterministicChecksum: string;
  readonly replayVerified: boolean;
  readonly scenarios: readonly DemoScenarioResult[];
}

export interface DemoIntelligence {
  readonly graphNodeCount: number;
  readonly graphEdgeCount: number;
  readonly explanation: { readonly kind: string; readonly rationale: string; readonly confidence: number; readonly evidenceCount: number; readonly alternativeCount: number };
  readonly recommendations: readonly { readonly category: string; readonly action: string; readonly confidence: number; readonly impact: string }[];
  readonly predictions: readonly { readonly metric: string; readonly value: number; readonly confidence: number; readonly method: string }[];
  readonly anomalies: readonly { readonly kind: string; readonly severity: string; readonly description: string }[];
  readonly learningSignals: number;
  readonly aiContracts: readonly string[];
}

export interface DemoGovernance {
  readonly versions: readonly { readonly id: string; readonly kind: string; readonly version: string; readonly lifecycle: string }[];
  readonly compatibilityResults: readonly { readonly dimension: string; readonly compatible: boolean; readonly details: string }[];
  readonly certifications: readonly { readonly kind: string; readonly subjectId: string; readonly status: string }[];
  readonly migrationPlan?: { readonly type: string; readonly from: string; readonly to: string; readonly stepCount: number; readonly dryRunOk: boolean };
  readonly policies: readonly { readonly kind: string; readonly enforcement: string }[];
  readonly lifecycleStates: readonly string[];
}

export interface DemoPlatform {
  readonly aiWorkforce: { readonly agentCount: number; readonly teamCount: number; readonly roleCount: number; readonly pendingApprovals: number; readonly handoffs: number; readonly memories: number };
  readonly communication: { readonly channelCount: number; readonly templateCount: number; readonly recipientCount: number; readonly notificationsDispatched: number; readonly suppressedChannels: number };
  readonly workflow: { readonly definitionCount: number; readonly instanceCount: number; readonly activeInstances: number; readonly completedInstances: number; readonly timersScheduled: number; readonly recurringJobs: number };
  readonly integration: { readonly connectorCount: number; readonly capabilityCount: number; readonly webhookEndpoints: number; readonly syncJobs: number; readonly paymentProvider: string };
  readonly twinRuntime: { readonly twinCount: number; readonly telemetryReadings: number; readonly predictions: number; readonly simulations: number; readonly recommendations: number; readonly healthIssues: number };
  readonly experience: { readonly sessionCount: number; readonly journeyCount: number; readonly intentCount: number; readonly milestonesTracked: number; readonly goals: number; readonly guidanceGenerated: number };
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
  readonly composition: DemoComposition;
  readonly conformance: DemoConformance;
  readonly intelligence: DemoIntelligence;
  readonly governance: DemoGovernance;
  readonly platform: DemoPlatform;
  readonly modules: readonly ModuleInfo[];
  readonly primitives: readonly PrimitiveInfo[];
}
