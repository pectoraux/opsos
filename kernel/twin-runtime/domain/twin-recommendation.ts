/**
 * @kernel/twin-runtime/domain/twin-recommendation — the TwinRecommendation value
 * object + RecommendationGenerator PORT.
 *
 * Recommendations are rule-generated suggestions derived from health +
 * predictions. They carry a category, a confidence, an expected impact, and
 * the evidence (issue/prediction references) that motivated them.
 *
 * Determinism rule: pure types — no `Date.now()`, no `Math.random()`. All
 * time flows through the `now` argument supplied by the caller.
 */

import type { TwinHealth } from "./twin-health";
import type { TwinPrediction } from "./twin-prediction";

/** The canonical recommendation categories. */
export type TwinRecommendationCategory =
  | "maintenance"
  | "optimization"
  | "risk"
  | "scheduling"
  | "resource-allocation";

/** A reference to the evidence (issue / prediction / reading) that
 *  motivated a recommendation. */
export interface TwinRecommendationEvidence {
  readonly kind: "issue" | "prediction" | "telemetry" | "simulation";
  readonly ref: string;
}

/**
 * A single rule-generated recommendation for an entity's twin.
 */
export interface TwinRecommendation {
  readonly id: string;
  readonly entityId: string;
  readonly category: TwinRecommendationCategory;
  readonly recommendation: string;
  /** Confidence in [0, 1]. */
  readonly confidence: number;
  readonly impact: "low" | "medium" | "high";
  readonly evidence: readonly TwinRecommendationEvidence[];
  /** Epoch-millis from the RuntimeClock / `now` argument. */
  readonly generatedAt: number;
}

/**
 * The RecommendationGenerator PORT. `generate` is a pure function of
 * `(entityId, health, predictions, now)`; the latest set per entity is
 * cached for `listRecommendations`.
 */
export interface RecommendationGenerator {
  generate(
    entityId: string,
    health: TwinHealth,
    predictions: readonly TwinPrediction[],
    now: number,
  ): readonly TwinRecommendation[];
  listRecommendations(entityId: string): readonly TwinRecommendation[];
}
