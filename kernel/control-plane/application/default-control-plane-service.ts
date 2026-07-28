/**
 * @kernel/control-plane/application/default-control-plane-service — aggregates
 * a `PlatformSnapshot` from the live kernel registries + lifecycle managers.
 *
 * READ-ONLY: queries state, never mutates. Mutating operations go through the
 * lifecycle managers (with confirmation in the UI).
 *
 * Dependencies are injected: protocol registry + lifecycle, application
 * lifecycle, event store, observability handles, projection engine, policy
 * engine, compiler pipeline. The service queries each and assembles the
 * snapshot.
 */

import type { ControlPlaneService } from "../domain/control-plane-service";
import type {
  PlatformSnapshot,
  PlatformHealth,
  HealthStatus,
  ProtocolSummary,
  OrganizationSummary,
  CapabilityView,
  IntentTypeView,
  WorkflowView,
  PolicyView,
  CompilerExtensionView,
  ObservabilityView,
  SimulationResult,
  SimulationStep,
} from "../domain/platform-snapshot";
import type { ProtocolRegistry } from "@kernel/protocol-sdk";
import type { ProtocolLifecycleManager } from "@kernel/protocol-sdk";
import type { ApplicationLifecycleManager } from "@kernel/application-runtime";
import type { ApplicationSummary } from "@kernel/application-runtime";
import type { EventStore, EventEnvelope } from "@kernel/events";
import type {
  ObservabilityBundle,
  MetricPoint,
  AuditEvent,
  DecisionProvenance,
} from "@kernel/observability";
import type { InMemoryMeter } from "@kernel/observability";
import type { InMemoryAuditSink } from "@kernel/observability";
import type { InMemoryTracer } from "@kernel/observability";
import type { InMemoryProvenanceRecorder } from "@kernel/observability";
import type { ProjectionEngine } from "@kernel/projections";
import type { Decision } from "@kernel/shared-kernel";
import { KERNEL_VERSION, KERNEL_API_VERSION } from "@kernel/protocol-sdk";

export interface ControlPlaneDeps {
  readonly protocolRegistry: ProtocolRegistry;
  readonly protocolLifecycle: ProtocolLifecycleManager;
  readonly appLifecycle: ApplicationLifecycleManager;
  readonly eventStore: EventStore;
  readonly observability: ObservabilityBundle;
  readonly projectionEngine?: ProjectionEngine;
  readonly recentDecisions?: readonly Decision[];
  readonly compilerTrace?: { stages: readonly { name: string; phase: string; ok: boolean; durationMs?: number }[]; graphId?: string; nodeCount: number };
  readonly simulation?: SimulationResult;
  readonly clock: { now(): number };
  readonly startTime: number;
}

export class DefaultControlPlaneService implements ControlPlaneService {
  constructor(private readonly deps: ControlPlaneDeps) {}

  async snapshot(): Promise<PlatformSnapshot> {
    const now = this.deps.clock.now();

    // ── Protocols ──────────────────────────────────────────────────────────
    const trackedProtocols = this.deps.protocolLifecycle.list();
    const protocols: ProtocolSummary[] = trackedProtocols.map((p) => ({
      id: p.manifest.id,
      name: p.manifest.name,
      displayName: p.manifest.displayName,
      version: p.manifest.version,
      state: p.state,
      contributionCounts: this.deps.protocolRegistry.contributionCounts(p.manifest.id),
    }));

    // ── Applications ───────────────────────────────────────────────────────
    const applications: readonly ApplicationSummary[] = this.deps.appLifecycle.list();

    // ── Organizations (derived from applications) ──────────────────────────
    const orgMap = new Map<string, OrganizationSummary>();
    for (const app of applications) {
      const orgId = String(app.organizationId);
      const existing = orgMap.get(orgId);
      if (existing) {
        orgMap.set(orgId, { ...existing, applicationCount: existing.applicationCount + 1 });
      } else {
        orgMap.set(orgId, {
          id: orgId,
          name: orgId,
          status: "active",
          tenantId: String(app.tenantId),
          memberCount: 0,
          applicationCount: 1,
        });
      }
    }
    const organizations = Array.from(orgMap.values());

    // ── Capability registry ────────────────────────────────────────────────
    const capabilities: CapabilityView[] = this.deps.protocolRegistry.capabilities.list().map((c) => ({
      id: String(c.id),
      capabilityType: c.capabilityType,
      ownerProtocolId: c.ownerProtocolId,
      version: c.version,
      inputCount: c.inputs.length,
      outputCount: c.outputs.length,
      tags: c.tags,
    }));

    // ── Intent registry ────────────────────────────────────────────────────
    const intentTypes: IntentTypeView[] = this.deps.protocolRegistry.intents.list().map((i) => ({
      intentType: i.intentType,
      ownerProtocolId: i.ownerProtocolId,
      version: i.version,
      requiredCapabilityCount: i.requiredCapabilities.length,
      compilerHookCount: i.compilerHooks.length,
    }));

    // ── Workflow registry ──────────────────────────────────────────────────
    const workflows: WorkflowView[] = this.deps.protocolRegistry.workflows.list().map((w) => ({
      id: w.id,
      name: w.name,
      ownerProtocolId: w.ownerProtocolId,
      stageCount: w.stages.length,
      triggerIntentTypes: w.triggerIntentTypes,
    }));

    // ── Policy registry ────────────────────────────────────────────────────
    const policyContribs = this.deps.protocolRegistry.policy;
    const policies: PolicyView[] = policyContribs.listPolicies().map((p) => ({
      id: String(p.id),
      name: p.name,
      ownerProtocolId: p.ownerProtocolId,
      scope: p.scope,
      effect: p.effect,
      priority: p.priority,
      ruleCount: p.ruleIds.length,
    }));

    // ── Compiler extensions ────────────────────────────────────────────────
    const compilerExtensions: CompilerExtensionView[] = this.deps.protocolRegistry.compilerExtensions.list().map((s) => ({
      name: s.name,
      ownerProtocolId: s.ownerProtocolId,
      phase: s.phase,
      order: s.order,
      insertion: s.insertion,
    }));

    // ── Projections ────────────────────────────────────────────────────────
    const projections = this.deps.projectionEngine
      ? this.deps.projectionEngine.list().map((p) => ({
          id: String(p.id),
          name: p.name,
          sourceEventTypes: p.sourceEventTypes,
        }))
      : [];

    // ── Observability ──────────────────────────────────────────────────────
    const eventCount = this.deps.eventStore.globalPosition();
    const recentEventsRaw = await this.readRecentEvents(10);
    const recentEvents = recentEventsRaw.map((e) => ({
      eventId: e.eventId,
      eventType: e.eventType,
      version: e.version,
      timestamp: e.timestamp,
      streamId: e.streamId,
    }));

    const meter = this.deps.observability.meter as unknown as { points?: MetricPoint[] };
    const metricPoints: MetricPoint[] = meter.points ?? [];

    const tracer = this.deps.observability.tracer as unknown as { spans?: Array<Span & { endedAt?: number; attributes: Record<string, unknown> }> };
    type Span = { name: string; context: { spanId: string; traceId: string }; endedAt?: number };
    const recentSpans = (tracer.spans ?? []).slice(-10).map((s) => ({
      name: s.name,
      spanId: s.context.spanId,
      traceId: s.context.traceId,
      endedAt: s.endedAt,
    }));

    const audit = this.deps.observability.audit as unknown as { events?: AuditEvent[] };
    const auditEvents = (audit.events ?? []).slice(-10);

    const provenance = this.deps.observability.provenance as unknown as { records?: DecisionProvenance[] };
    const decisions = (provenance.records ?? []).slice(-10);

    const observability: ObservabilityView = {
      eventCount,
      recentEvents,
      metricPoints,
      spanCount: (tracer.spans ?? []).length,
      recentSpans,
      auditEvents,
      decisions,
      logs: [],
    };

    // ── Health ─────────────────────────────────────────────────────────────
    const activeAppCount = applications.filter((a) => a.status === "active").length;
    const checks: PlatformHealth["checks"] = [
      { name: "event-store", status: "healthy", detail: `${eventCount} events` },
      { name: "protocols", status: protocols.length > 0 ? "healthy" : "degraded", detail: `${protocols.length} installed` },
      { name: "applications", status: "healthy", detail: `${activeAppCount} active` },
      { name: "projections", status: "healthy", detail: `${projections.length} registered` },
      { name: "compiler", status: "healthy", detail: `${compilerExtensions.length + 9} stages` },
    ];
    const overallStatus: HealthStatus = checks.some((c) => c.status === "unhealthy")
      ? "unhealthy"
      : checks.some((c) => c.status === "degraded")
      ? "degraded"
      : "healthy";

    const health: PlatformHealth = {
      status: overallStatus,
      kernelVersion: KERNEL_VERSION,
      apiVersion: KERNEL_API_VERSION,
      protocolCount: protocols.length,
      applicationCount: applications.length,
      activeApplicationCount: activeAppCount,
      eventStorePosition: eventCount,
      projectionCount: projections.length,
      compilerStageCount: compilerExtensions.length + 9, // 9 kernel stages + extensions
      uptime: now - this.deps.startTime,
      checks,
    };

    return {
      generatedAt: now,
      health,
      protocols,
      applications,
      organizations,
      capabilities,
      intentTypes,
      workflows,
      policies,
      compilerExtensions,
      projections,
      readModels: [],
      observability,
      simulation: this.deps.simulation,
      recentDecisions: this.deps.recentDecisions ?? [],
      compilerTrace: this.deps.compilerTrace,
    };
  }

  private async readRecentEvents(count: number): Promise<readonly EventEnvelope[]> {
    const all: EventEnvelope[] = [];
    const cursor = this.deps.eventStore.globalPosition();
    const from = Math.max(0, cursor - count);
    for await (const e of this.deps.eventStore.readAll(from)) {
      all.push(e);
    }
    return all.slice(-count);
  }
}
