/**
 * @kernel/intelligence/application/generate-recommendations — use-case that
 * produces advisory recommendations.
 *
 * Thin orchestrator: delegates to the injected `RecommendationEngine`. The
 * returned list is ADVISORY ONLY — intelligence never performs work. Callers
 * (operators or external automations) decide whether to act, and act through
 * the kernel's command side.
 *
 * Deterministic given identical engine + input.
 */
import type { Recommendation, RecommendationEngine } from "../domain";

/** Input to `generateRecommendations`. */
export interface GenerateRecommendationsInput {
  readonly context?: Readonly<Record<string, unknown>>;
}

/** Deps — the engine that produces the recommendations. */
export interface GenerateRecommendationsDeps {
  readonly engine: RecommendationEngine;
}

/** `generateRecommendations` — produces an advisory list. */
export function generateRecommendations(
  input: GenerateRecommendationsInput,
  deps: GenerateRecommendationsDeps
): readonly Recommendation[] {
  return deps.engine.recommend(input.context);
}

/** `GenerateRecommendations` — class form of the use-case. */
export class GenerateRecommendations {
  constructor(private readonly deps: GenerateRecommendationsDeps) {}

  execute(input: GenerateRecommendationsInput): readonly Recommendation[] {
    return generateRecommendations(input, this.deps);
  }
}
