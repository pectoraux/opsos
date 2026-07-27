/**
 * @kernel/conformance/domain/explainability — the trace the ConformanceEngine
 * produces so a human (or auditor) can read WHY the simulation behaved the
 * way it did. Every step is timestamped (epoch-millis from the
 * FixedRuntimeClock) and tied to the canonical pipeline stages.
 */
import type { ConformanceMetrics } from "./conformance-metrics";

/** A single step in the execution trace. */
export interface TraceStep {
  readonly step: string;
  readonly at: number;
  readonly detail: string;
}

/** A compiler-stage decision (parsed, validated, optimised, planned, routed). */
export interface CompilerDecision {
  readonly stage: string;
  readonly outcome: "ok" | "skip" | "fail";
  readonly rationale: string;
}

/** A policy-engine decision (allow/deny/prefer/penalize). */
export interface PolicyDecision {
  readonly policyId: string;
  readonly effect: "allow" | "deny" | "prefer" | "penalize";
  readonly target: string;
  readonly rationale: string;
}

/** The matching engine's rationale for choosing (or rejecting) a resource. */
export interface MatchingRationale {
  readonly resourceId: string;
  readonly score: number;
  readonly selected: boolean;
  readonly rationale: string;
}

/** A reference to a knowledge item the simulation consulted. */
export interface KnowledgeReference {
  readonly knowledgeItemId: string;
  readonly subject: string;
  readonly status: "active" | "retired" | "draft" | "missing";
  readonly consultedAt: number;
}

/** A point on the event timeline (one per emitted event). */
export interface EventTimelineEntry {
  readonly eventId: string;
  readonly eventType: string;
  readonly version: number;
  readonly timestamp: number;
}

/** The replay-verification sub-trace. */
export interface ReplayVerification {
  readonly firstChecksum: string;
  readonly secondChecksum: string;
  readonly verified: boolean;
  readonly note: string;
}

export interface ExplainabilityTrace {
  readonly executionTrace: readonly TraceStep[];
  readonly compilerDecisions: readonly CompilerDecision[];
  readonly policyDecisions: readonly PolicyDecision[];
  readonly matchingRationale: readonly MatchingRationale[];
  readonly knowledgeReferences: readonly KnowledgeReference[];
  readonly eventTimeline: readonly EventTimelineEntry[];
  readonly replayVerification: ReplayVerification;
  readonly metrics: ConformanceMetrics;
}
