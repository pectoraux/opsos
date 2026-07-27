/**
 * @kernel/conformance/infrastructure/default-explainability-engine — the
 * default `ExplainabilityEngine`.
 *
 * Transforms a flat `SimulationResult` into a structured `ExplainabilityTrace`
 * by categorising the simulation's decisions and trace steps into the
 * canonical explainability buckets: compilerDecisions, policyDecisions,
 * matchingRationale, knowledgeReferences, eventTimeline.
 *
 * Categorisation rules (deterministic):
 *   - `outcome` prefix `compile:`  → CompilerDecision (stage = suffix)
 *   - `outcome` prefix `package:`  → CompilerDecision (stage = "package-check")
 *   - `outcome` prefix `policy:`   → PolicyDecision
 *   - `outcome` prefix `match:`    → MatchingRationale
 *   - `outcome` prefix `assignment:` → MatchingRationale (selected = true)
 *   - `outcome` prefix `transfer:` → MatchingRationale
 *   - `outcome` prefix `negotiation:` → MatchingRationale
 *   - `outcome` prefix `queue:`    → MatchingRationale
 *   - `outcome` prefix `knowledge:` → KnowledgeReference
 *   - `outcome` prefix `capacity:` → MatchingRationale
 *   - `outcome` prefix `reservation:` → MatchingRationale
 *   - `outcome` prefix `twin:`     → MatchingRationale
 *
 * The replay verification is supplied by the caller (the ConformanceEngine
 * runs the simulation twice and produces the two checksums).
 */
import type {
  ConformanceMetrics,
  ExplainabilityTrace,
  Scenario,
  SimulationResult,
} from "../domain";
import type {
  CompilerDecision,
  EventTimelineEntry,
  KnowledgeReference,
  MatchingRationale,
  PolicyDecision,
  ReplayVerification,
  TraceStep,
} from "../domain";

export interface ExplainabilityEngine {
  buildTrace(
    scenario: Scenario,
    simulation: SimulationResult,
    replay: ReplayVerification
  ): ExplainabilityTrace;
}

export class DefaultExplainabilityEngine implements ExplainabilityEngine {
  buildTrace(
    scenario: Scenario,
    simulation: SimulationResult,
    replay: ReplayVerification
  ): ExplainabilityTrace {
    const executionTrace: TraceStep[] = simulation.trace.map((s) => ({
      step: s.step,
      at: s.at,
      detail: s.detail,
    }));

    const compilerDecisions: CompilerDecision[] = [];
    const policyDecisions: PolicyDecision[] = [];
    const matchingRationale: MatchingRationale[] = [];
    const knowledgeReferences: KnowledgeReference[] = [];

    for (const d of simulation.decisions) {
      const colonIdx = d.outcome.indexOf(":");
      const prefix = colonIdx === -1 ? d.outcome : d.outcome.slice(0, colonIdx);
      const suffix = colonIdx === -1 ? "" : d.outcome.slice(colonIdx + 1);

      switch (prefix) {
        case "compile":
          compilerDecisions.push({
            stage: suffix || "unknown",
            outcome: suffix === "fail" ? "fail" : "ok",
            rationale: d.rationale,
          });
          break;
        case "package":
          compilerDecisions.push({
            stage: "package-check",
            outcome: suffix === "rejected" ? "fail" : "ok",
            rationale: d.rationale,
          });
          break;
        case "policy":
          policyDecisions.push({
            policyId: extractId(d.rationale, "Policy"),
            effect: suffix === "deny" ? "deny" : suffix === "allow" ? "allow" : suffix === "prefer" ? "prefer" : "penalize",
            target: "*",
            rationale: d.rationale,
          });
          break;
        case "match":
          matchingRationale.push({
            resourceId: extractId(d.rationale, "Resource") || extractId(d.rationale, "Demand") || "*",
            score: extractScore(d.rationale),
            selected: suffix === "selected",
            rationale: d.rationale,
          });
          break;
        case "assignment":
          matchingRationale.push({
            resourceId: extractId(d.rationale, "Resource") || extractId(d.rationale, "Assignment") || "*",
            score: 0,
            selected: suffix === "accepted",
            rationale: d.rationale,
          });
          break;
        case "transfer":
        case "negotiation":
        case "queue":
        case "capacity":
        case "reservation":
        case "twin":
          matchingRationale.push({
            resourceId: "*",
            score: 0,
            selected: false,
            rationale: d.rationale,
          });
          break;
        case "knowledge":
          knowledgeReferences.push({
            knowledgeItemId: extractId(d.rationale, "Knowledge") || "*",
            subject: d.rationale,
            status: suffix === "empty" ? "retired" : "active",
            consultedAt: simulation.metrics.latencyMs,
          });
          break;
        default:
          // Uncategorised — record as a compiler trace for visibility.
          compilerDecisions.push({
            stage: prefix || "unknown",
            outcome: "ok",
            rationale: d.rationale,
          });
      }
    }

    // Augment matching rationale with scores from the simulation's matches.
    for (const m of simulation.matches) {
      const existing = matchingRationale.find((r) => r.resourceId === m.resourceId && r.selected);
      if (existing !== undefined) {
        const idx = matchingRationale.indexOf(existing);
        matchingRationale[idx] = { ...existing, score: m.score };
      }
    }

    const eventTimeline: EventTimelineEntry[] = simulation.events.map((e) => ({
      eventId: e.eventId,
      eventType: e.eventType,
      version: e.version,
      timestamp: e.timestamp,
    }));

    const metrics: ConformanceMetrics = simulation.metrics;

    void scenario;

    return {
      executionTrace,
      compilerDecisions,
      policyDecisions,
      matchingRationale,
      knowledgeReferences,
      eventTimeline,
      replayVerification: replay,
      metrics,
    };
  }
}

/** Extract a `<Kind> <id>` token's id from a rationale string. */
function extractId(rationale: string, kind: string): string {
  const re = new RegExp(`${kind}\\s+([A-Za-z0-9_-]+)`);
  const m = re.exec(rationale);
  return m === null ? "" : m[1]!;
}

/** Extract a `score <n>` token's number from a rationale string. */
function extractScore(rationale: string): number {
  const m = /score\s+([0-9.]+)/.exec(rationale);
  return m === null ? 0 : Number(m[1]);
}
