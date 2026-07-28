/**
 * @kernel/intelligence/infrastructure/default-recommendation-engine —
 * `DefaultRecommendationEngine`.
 *
 * Deterministic, rule-based `RecommendationEngine`. Produces ADVISORY
 * recommendations by inspecting:
 *   - the injected `IntelligenceGraph` (e.g. orphaned work nodes →
 *     workflow-simplification; resources referenced by no policy →
 *     policy-improvement);
 *   - caller-supplied `context` signals (utilisation, missing knowledge /
 *     capabilities, policy violations, queue growth, execution overrun).
 *
 * This is NOT an AI. It is a deterministic baseline. AI-backed recommenders
 * implement the same port.
 *
 * Advisory ONLY — intelligence never performs work. The returned list is sorted
 * by priority descending, then id ascending, for stable display.
 *
 * Determinism: NO `Date.now()` / `Math.random()`. Identical
 * (context, graph, learning) → identical recommendations.
 */
import type {
  Recommendation,
  RecommendationCategory,
  RecommendationEngine,
  IntelligenceGraph,
  LearningSignalStore,
} from "../domain";

export interface DefaultRecommendationEngineOptions {
  readonly graph?: IntelligenceGraph;
  readonly learning?: LearningSignalStore;
}

export class DefaultRecommendationEngine implements RecommendationEngine {
  private readonly graph: IntelligenceGraph | undefined;
  private readonly learning: LearningSignalStore | undefined;

  constructor(options: DefaultRecommendationEngineOptions = {}) {
    this.graph = options.graph;
    this.learning = options.learning;
  }

  recommend(
    context?: Readonly<Record<string, unknown>>
  ): readonly Recommendation[] {
    const ctx = context ?? {};
    const recs: Recommendation[] = [];

    // ── Graph-derived recommendations ─────────────────────────────────
    if (this.graph) {
      const stats = this.graph.stats();
      // Orphaned work: work nodes with no incoming edges.
      const workNodes = this.graph.query({ kind: "work" });
      for (const w of workNodes) {
        const inbound = this.graph.getNeighbors(w.id, "in");
        if (inbound.length === 0) {
          recs.push(
            this.makeRec(
              "workflow-simplification",
              "work",
              w.id,
              `Review orphaned work '${w.label}': it has no inbound assignments or causes recorded.`,
              `Work node '${w.id}' has zero incoming edges in the intelligence graph, suggesting it may be untracked or stale.`,
              0.6,
              "medium",
              "medium",
              40
            )
          );
        }
      }
      // Knowledge items referenced by no capability/policy → knowledge-gap.
      const knowledgeNodes = this.graph.query({ kind: "knowledge" });
      for (const k of knowledgeNodes) {
        const consumers = this.graph.getNeighbors(k.id, "in");
        const hasConsumer = consumers.some(
          (c) => c.kind === "capability" || c.kind === "policy"
        );
        if (!hasConsumer) {
          recs.push(
            this.makeRec(
              "knowledge-gap",
              "knowledge",
              k.id,
              `Link knowledge item '${k.label}' to a capability or policy, or retire it.`,
              `Knowledge node '${k.id}' is referenced by no capability or policy — its operational value is unverified.`,
              0.55,
              "medium",
              "low",
              50
            )
          );
        }
      }
      // If there are resources but no capabilities → capability-gap.
      const resourceCount = stats.nodesByKind["resource"] ?? 0;
      const capabilityCount = stats.nodesByKind["capability"] ?? 0;
      if (resourceCount > 0 && capabilityCount === 0) {
        recs.push(
          this.makeRec(
            "capability-gap",
            "graph",
            "no-capabilities",
            `Define capabilities for the ${resourceCount} registered resource(s).`,
            "Resources exist in the graph but no capabilities are modelled — matching cannot occur.",
            0.7,
            "high",
            "high",
            50
          )
        );
      }
    }

    // ── Context-derived recommendations ───────────────────────────────
    const utilization = readNumber(ctx, "utilization");
    if (utilization > 0.8) {
      recs.push(
        this.makeRec(
          "resource-utilization",
          "system",
          "utilization",
          `Rebalance load — resource utilisation is at ${Math.round(utilization * 100)}%.`,
          "Sustained utilisation above 80% risks saturation and tail-latency blow-up.",
          0.8,
          "high",
          "medium",
          70 + Math.round((utilization - 0.8) * 100)
        )
      );
    } else if (utilization > 0 && utilization < 0.3) {
      recs.push(
        this.makeRec(
          "optimization",
          "system",
          "utilization",
          `Consolidate or downscale — resource utilisation is only ${Math.round(utilization * 100)}%.`,
          "Utilisation below 30% indicates over-provisioning.",
          0.65,
          "medium",
          "medium",
          55
        )
      );
    }

    const missingKnowledge = readArray<string>(ctx, "missingKnowledge");
    if (missingKnowledge.length > 0) {
      recs.push(
        this.makeRec(
          "knowledge-gap",
          "system",
          "missing-knowledge",
          `Acquire or register ${missingKnowledge.length} missing knowledge item(s): ${missingKnowledge.slice(0, 3).join(", ")}${missingKnowledge.length > 3 ? "…" : ""}.`,
          "Missing knowledge prevents correct matching and policy evaluation.",
          0.75,
          "medium",
          "medium",
          55 + missingKnowledge.length
        )
      );
    }

    const missingCapabilities = readArray<string>(ctx, "missingCapabilities");
    if (missingCapabilities.length > 0) {
      recs.push(
        this.makeRec(
          "capability-gap",
          "system",
          "missing-capabilities",
          `Provision resources for ${missingCapabilities.length} missing capability type(s): ${missingCapabilities.slice(0, 3).join(", ")}${missingCapabilities.length > 3 ? "…" : ""}.`,
          "Demands cannot be matched to resources lacking the required capabilities.",
          0.8,
          "high",
          "high",
          55 + missingCapabilities.length
        )
      );
    }

    const violations = readArray(ctx, "policyViolations");
    if (violations.length > 0) {
      recs.push(
        this.makeRec(
          "risk-reduction",
          "system",
          "policy-violations",
          `Investigate ${violations.length} recent policy violation(s) and tighten enforcement or policy rules.`,
          "Policy violations indicate either rule gaps or intentional bypass — both are risk.",
          0.85,
          "high",
          "low",
          80 + violations.length
        )
      );
      recs.push(
        this.makeRec(
          "policy-improvement",
          "system",
          "policy-violations",
          `Review the violated policy rules for clarity and coverage.`,
          "Recurring violations on the same rule often signal an underspecified policy.",
          0.6,
          "medium",
          "medium",
          55
        )
      );
    }

    const queueGrowthRate = readNumber(ctx, "queueGrowthRate");
    if (queueGrowthRate > 0) {
      recs.push(
        this.makeRec(
          "scheduling",
          "system",
          "queue-growth",
          `Queue is growing at ${queueGrowthRate.toFixed(2)} entries/interval — review scheduling discipline or capacity.`,
          "Positive queue growth will eventually breach SLA thresholds.",
          0.7,
          "medium",
          "low",
          65 + Math.min(Math.round(queueGrowthRate * 5), 20)
        )
      );
    }

    const actualDuration = readNumber(ctx, "executionDurationMs");
    const expectedDuration = readNumber(ctx, "expectedDurationMs");
    if (expectedDuration > 0 && actualDuration > expectedDuration * 1.2) {
      recs.push(
        this.makeRec(
          "optimization",
          "system",
          "execution-overrun",
          `Optimise the execution path — actual ${actualDuration}ms exceeds expected ${expectedDuration}ms by ${Math.round(((actualDuration - expectedDuration) / expectedDuration) * 100)}%.`,
          "Sustained execution overrun suggests a suboptimal plan or degraded resource.",
          0.7,
          "medium",
          "medium",
          60
        )
      );
    }

    // ── Learning-signal-derived recommendations ───────────────────────
    if (this.learning) {
      // If the store is non-empty, surface a knowledge-consolidation nudge.
      const all = this.learning.list();
      if (all.length >= 10) {
        const lowConfidence = all.filter((s) => s.confidence < 0.5).length;
        if (lowConfidence > 0) {
          recs.push(
            this.makeRec(
              "knowledge-gap",
              "system",
              "low-confidence-signals",
              `Consolidate ${lowConfidence} low-confidence learning signal(s) into authoritative knowledge.`,
              "Accumulated low-confidence observations degrade prediction quality.",
              0.55,
              "low",
              "medium",
              45
            )
          );
        }
      }
    }

    // ── Baseline (always present, lowest priority) ────────────────────
    if (recs.length === 0) {
      recs.push(
        this.makeRec(
          "optimization",
          "system",
          "baseline",
          "No actionable signals detected — review the operational baseline periodically.",
          "The intelligence graph and context carry no threshold-breaching signals at this time.",
          0.4,
          "low",
          "low",
          10
        )
      );
    }

    // ── Sort by priority desc, then id asc ────────────────────────────
    recs.sort((a, b) =>
      b.priority !== a.priority
        ? b.priority - a.priority
        : a.id < b.id
          ? -1
          : a.id > b.id
            ? 1
            : 0
    );
    return recs;
  }

  private makeRec(
    category: RecommendationCategory,
    subjectKind: string,
    subjectId: string,
    proposedAction: string,
    rationale: string,
    confidence: number,
    impact: "low" | "medium" | "high",
    effort: "low" | "medium" | "high",
    priority: number
  ): Recommendation {
    return {
      id: `rec#${category}#${subjectKind}#${subjectId}`,
      category,
      subject: { kind: subjectKind, id: subjectId },
      proposedAction,
      rationale,
      confidence: clamp01(confidence),
      impact,
      effort,
      priority,
    };
  }
}

// ── Deterministic context readers ─────────────────────────────────────────

function readArray<T>(
  ctx: Readonly<Record<string, unknown>>,
  key: string
): T[] {
  const v = ctx[key];
  return Array.isArray(v) ? (v as T[]) : [];
}

function readNumber(
  ctx: Readonly<Record<string, unknown>>,
  key: string
): number {
  const v = ctx[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
