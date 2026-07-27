/**
 * @kernel/intelligence/infrastructure — infrastructure barrel.
 *
 * Re-exports the default engine implementations, the in-memory graph, the
 * in-memory learning-signal store, the mock AI providers, and the
 * `createIntelligenceFramework()` factory.
 *
 * Callers who want a fully-wired default framework can use:
 *
 *   import { createIntelligenceFramework } from "@kernel/intelligence";
 *   const fw = createIntelligenceFramework();
 *   const recs = fw.recommendation.recommend({ utilization: 0.9 });
 *
 * Callers who want custom wiring (e.g. injecting an AI-backed engine) can
 * construct the parts directly.
 *
 * Determinism: every implementation here is deterministic. No `Date.now()` /
 * `Math.random()`. The factory's default clock is a fixed clock at 0
 * (`IntelligenceFixedClock`); callers may inject their own `RuntimeClock`.
 */
import { FixedClock, type RuntimeClock } from "@kernel/shared-kernel";

export * from "./in-memory-intelligence-graph";
export * from "./default-explanation-engine";
export * from "./default-recommendation-engine";
export * from "./default-prediction-engine";
export * from "./default-anomaly-detector";
export * from "./in-memory-learning-signal-store";
export * from "./mock-ai-providers";

import { InMemoryIntelligenceGraph } from "./in-memory-intelligence-graph";
import { DefaultExplanationEngine } from "./default-explanation-engine";
import { DefaultRecommendationEngine } from "./default-recommendation-engine";
import { DefaultPredictionEngine } from "./default-prediction-engine";
import { DefaultAnomalyDetector } from "./default-anomaly-detector";
import { InMemoryLearningSignalStore } from "./in-memory-learning-signal-store";
import {
  createMockAIProviders,
  type MockAIProviderBundle,
} from "./mock-ai-providers";

/**
 * Concrete fixed clock for the intelligence framework. Defaults to `now()=0`.
 * Used as the shared time source when no `RuntimeClock` is injected.
 */
export class IntelligenceFixedClock extends FixedClock {
  constructor(now: number = 0) {
    super(now, 0);
  }
}

/** Options for `createIntelligenceFramework`. */
export interface CreateIntelligenceFrameworkOptions {
  readonly clock?: RuntimeClock;
  readonly now?: number;
}

/**
 * A fully-wired intelligence framework bundle. All engines share the same
 * `graph`, `learning` store, and `clock`.
 */
export interface IntelligenceFramework {
  readonly graph: InMemoryIntelligenceGraph;
  readonly explanation: DefaultExplanationEngine;
  readonly recommendation: DefaultRecommendationEngine;
  readonly prediction: DefaultPredictionEngine;
  readonly anomaly: DefaultAnomalyDetector;
  readonly learning: InMemoryLearningSignalStore;
  readonly ai: MockAIProviderBundle;
  readonly clock: RuntimeClock;
}

/**
 * `createIntelligenceFramework` — builds a fresh, fully-wired intelligence
 * framework with deterministic default engines and mock AI providers.
 *
 * - `graph` is shared by the explanation, recommendation, and anomaly engines.
 * - `learning` store is shared by the recommendation engine and the bundle.
 * - `clock` is shared by the anomaly detector and the mock memory provider.
 *   Defaults to a fixed clock at `now` (default 0) — never `Date.now()`.
 *
 * The returned bundle is ready for self-test / conformance. To plug in real AI,
 * construct the parts directly and inject an AI-backed engine that implements
 * the relevant port(s) from `domain/ai-contracts.ts`.
 */
export function createIntelligenceFramework(
  options: CreateIntelligenceFrameworkOptions = {}
): IntelligenceFramework {
  const clock: RuntimeClock =
    options.clock ??
    new IntelligenceFixedClock(options.now ?? 0);
  const graph = new InMemoryIntelligenceGraph();
  const learning = new InMemoryLearningSignalStore();
  const explanation = new DefaultExplanationEngine({ graph });
  const recommendation = new DefaultRecommendationEngine({ graph, learning });
  const prediction = new DefaultPredictionEngine();
  const anomaly = new DefaultAnomalyDetector({ graph, clock });
  const ai = createMockAIProviders({ clock });
  return {
    graph,
    explanation,
    recommendation,
    prediction,
    anomaly,
    learning,
    ai,
    clock,
  };
}
