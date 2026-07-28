/**
 * @kernel/twin-runtime/infrastructure/default-recommendation-generator — the
 * default rule-based `RecommendationGenerator`.
 *
 * Deterministic rules mapping health status + prediction trends to
 * recommendations:
 *   - critical health (or any critical issue) → maintenance recommendation
 *     (high impact, confidence 0.9).
 *   - degraded health (or any warn issue) → maintenance recommendation
 *     (medium impact, confidence 0.7).
 *   - any prediction with confidence ≥ 0.6 whose predictedValue differs from
 *     the latest reading by ≥ 20% → optimization recommendation (impact
 *     scaled by change magnitude).
 *   - any prediction with confidence < 0.4 → risk recommendation (low
 *     impact, confidence = 1 - prediction confidence).
 *   - healthy status with no other recommendations → low-impact optimization
 *     nudge (confidence 0.5).
 *
 * Each recommendation carries evidence references (issue ids / prediction
 * ids). No `Date.now()` / `Math.random()`.
 */

import type {
  TwinHealth,
  TwinPrediction,
  TwinRecommendation,
  TwinRecommendationCategory,
  TwinRecommendationEvidence,
  RecommendationGenerator,
  TelemetryStream,
} from "../domain";
import { clampUnit } from "../domain";

const HIGH_CHANGE_RATIO = 0.2;
const HIGH_CONFIDENCE = 0.6;
const LOW_CONFIDENCE = 0.4;

export class DefaultRecommendationGenerator implements RecommendationGenerator {
  private readonly byEntity = new Map<string, TwinRecommendation[]>();

  constructor(private readonly telemetry: TelemetryStream) {}

  generate(
    entityId: string,
    health: TwinHealth,
    predictions: readonly TwinPrediction[],
    now: number,
  ): readonly TwinRecommendation[] {
    const recs: TwinRecommendation[] = [];
    let idx = 0;
    const mk = (
      category: TwinRecommendationCategory,
      recommendation: string,
      confidence: number,
      impact: "low" | "medium" | "high",
      evidence: TwinRecommendationEvidence[],
    ): TwinRecommendation => {
      const id = `rec#${entityId}#${idx}#${now}`;
      idx++; // ensure each recommendation gets a distinct deterministic id
      return {
        id,
        entityId,
        category,
        recommendation,
        confidence: clampUnit(confidence),
        impact,
        evidence,
        generatedAt: now,
      };
    };

    // ── Maintenance recommendations from health status ────────────────────
    const criticalIssues = health.issues.filter((i) => i.severity === "critical");
    const warnIssues = health.issues.filter((i) => i.severity === "warn");
    if (health.status === "critical" || criticalIssues.length > 0) {
      recs.push(
        mk(
          "maintenance",
          `Schedule immediate maintenance for ${entityId}: ${criticalIssues.length} critical issue(s) detected.`,
          0.9,
          "high",
          criticalIssues.map((i) => ({ kind: "issue", ref: i.id })),
        ),
      );
    } else if (health.status === "degraded" || warnIssues.length > 0) {
      recs.push(
        mk(
          "maintenance",
          `Schedule preventive maintenance for ${entityId}: ${warnIssues.length} warning(s) detected.`,
          0.7,
          "medium",
          warnIssues.map((i) => ({ kind: "issue", ref: i.id })),
        ),
      );
    }

    // ── Optimization / risk recommendations from predictions ──────────────
    for (const p of predictions) {
      const latest = this.telemetry.getLatest(entityId, p.metric);
      const currentValue = latest?.value;
      if (
        p.confidence >= HIGH_CONFIDENCE &&
        typeof currentValue === "number" &&
        currentValue !== 0
      ) {
        const change = Math.abs(p.predictedValue - currentValue) / Math.abs(currentValue);
        if (change >= HIGH_CHANGE_RATIO) {
          recs.push(
            mk(
              "optimization",
              `Optimize ${p.metric} for ${entityId}: predicted ${p.predictedValue.toFixed(2)} vs current ${currentValue.toFixed(2)} (${(change * 100).toFixed(0)}% change).`,
              p.confidence,
              change >= 0.5 ? "high" : "medium",
              [{ kind: "prediction", ref: p.id }],
            ),
          );
        }
      }
      if (p.confidence < LOW_CONFIDENCE) {
        recs.push(
          mk(
            "risk",
            `Increase observation cadence for ${p.metric} on ${entityId}: prediction confidence is low (${p.confidence.toFixed(2)}).`,
            1 - p.confidence,
            "low",
            [{ kind: "prediction", ref: p.id }],
          ),
        );
      }
    }

    // ── Healthy → low-impact optimization nudge ───────────────────────────
    if (health.status === "healthy" && recs.length === 0) {
      recs.push(
        mk(
          "optimization",
          `No issues detected for ${entityId}; continue current operating profile.`,
          0.5,
          "low",
          [],
        ),
      );
    }

    this.byEntity.set(entityId, recs);
    return recs;
  }

  listRecommendations(entityId: string): readonly TwinRecommendation[] {
    return this.byEntity.get(entityId) ?? [];
  }
}
