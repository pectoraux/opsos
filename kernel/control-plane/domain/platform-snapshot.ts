/**
 * @kernel/control-plane/domain/platform-snapshot — the aggregate snapshot the
 * Control Plane renders from.
 *
 * A `PlatformSnapshot` is a single, serialisable data object containing
 * everything the admin console needs to display in one render pass: installed
 * protocols, applications, organizations, runtime/compiler/events/projections
 * state, registries (capabilities/intents/workflows/policies/extensions),
 * observability (metrics/traces/logs/audit/provenance), simulation results,
 * and health.
 *
 * The snapshot is READ-ONLY. It is produced by the `ControlPlaneService` from
 * the live kernel registries + lifecycle managers. The admin UI never mutates
 * kernel state directly — mutating operations go through the lifecycle managers
 * (with confirmation).
 */

import type { TrackedProtocol } from "@kernel/protocol-sdk";
import type { ApplicationSummary } from "@kernel/application-runtime";
import type { EventEnvelope } from "@kernel/events";
import type { ExecutionResult } from "@kernel/runtime";
import type { CompilerResult } from "@kernel/compiler";
import type { ProjectionDefinition, ReadModel } from "@kernel/projections";
import type { Decision } from "@kernel/policy";
import type { Span, MetricPoint, AuditEvent, DecisionProvenance } from "@kernel/observability";

// ── Platform entities ───────────────────────────────────────────────────────

export interface ProtocolSummary {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly version: string;
  readonly state: string;
  readonly contributionCounts: Readonly<Record<string, number>>;
}

export interface ApplicationSummaryCP extends ApplicationSummary {}

export interface OrganizationSummary {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly tenantId: string;
  readonly memberCount: number;
  readonly applicationCount: number;
}

// ── Registry views ──────────────────────────────────────────────────────────

export interface CapabilityView {
  readonly id: string;
  readonly capabilityType: string;
  readonly ownerProtocolId: string;
  readonly version: string;
  readonly inputCount: number;
  readonly outputCount: number;
  readonly tags: readonly string[];
}

export interface IntentTypeView {
  readonly intentType: string;
  readonly ownerProtocolId: string;
  readonly version: string;
  readonly requiredCapabilityCount: number;
  readonly compilerHookCount: number;
}

export interface WorkflowView {
  readonly id: string;
  readonly name: string;
  readonly ownerProtocolId: string;
  readonly stageCount: number;
  readonly triggerIntentTypes: readonly string[];
}

export interface PolicyView {
  readonly id: string;
  readonly name: string;
  readonly ownerProtocolId: string;
  readonly scope: string;
  readonly effect: string;
  readonly priority: number;
  readonly ruleCount: number;
}

export interface CompilerExtensionView {
  readonly name: string;
  readonly ownerProtocolId: string;
  readonly phase: string;
  readonly order: number;
  readonly insertion: string;
}

// ── Observability views ─────────────────────────────────────────────────────

export interface ObservabilityView {
  readonly eventCount: number;
  readonly recentEvents: readonly { eventId: string; eventType: string; version: number; timestamp: number; streamId: string }[];
  readonly metricPoints: readonly MetricPoint[];
  readonly spanCount: number;
  readonly recentSpans: readonly { name: string; spanId: string; traceId: string; endedAt?: number }[];
  readonly auditEvents: readonly AuditEvent[];
  readonly decisions: readonly DecisionProvenance[];
  readonly logs: readonly { level: string; message: string; timestamp: number }[];
}

// ── Health ──────────────────────────────────────────────────────────────────

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface PlatformHealth {
  readonly status: HealthStatus;
  readonly kernelVersion: string;
  readonly apiVersion: string;
  readonly protocolCount: number;
  readonly applicationCount: number;
  readonly activeApplicationCount: number;
  readonly eventStorePosition: number;
  readonly projectionCount: number;
  readonly compilerStageCount: number;
  readonly uptime: number;
  readonly checks: readonly { name: string; status: HealthStatus; detail?: string }[];
}

// ── Simulation ──────────────────────────────────────────────────────────────

export interface SimulationStep {
  readonly nodeId: string;
  readonly status: string;
  readonly startedAt: number;
  readonly endedAt?: number;
  readonly outputs?: Readonly<Record<string, unknown>>;
  readonly error?: string;
}

export interface SimulationResult {
  readonly scenario: string;
  readonly ok: boolean;
  readonly steps: readonly SimulationStep[];
  readonly eventsEmitted: number;
  readonly seed: number;
  readonly ranAt: number;
  readonly assumptions: readonly string[];
}

// ── The full snapshot ───────────────────────────────────────────────────────

export interface PlatformSnapshot {
  readonly generatedAt: number;
  readonly health: PlatformHealth;
  readonly protocols: readonly ProtocolSummary[];
  readonly applications: readonly ApplicationSummaryCP[];
  readonly organizations: readonly OrganizationSummary[];
  readonly capabilities: readonly CapabilityView[];
  readonly intentTypes: readonly IntentTypeView[];
  readonly workflows: readonly WorkflowView[];
  readonly policies: readonly PolicyView[];
  readonly compilerExtensions: readonly CompilerExtensionView[];
  readonly projections: readonly { id: string; name: string; sourceEventTypes: readonly string[] }[];
  readonly readModels: readonly { projectionId: string; key: string; lastEventVersion: number; updatedAt: number }[];
  readonly observability: ObservabilityView;
  readonly simulation?: SimulationResult;
  readonly recentDecisions: readonly Decision[];
  readonly compilerTrace?: { stages: readonly { name: string; phase: string; ok: boolean; durationMs?: number }[]; graphId?: string; nodeCount: number };
}
