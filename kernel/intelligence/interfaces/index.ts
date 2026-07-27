/**
 * @kernel/intelligence — public surface.
 *
 * The Operational Intelligence Framework — the universal intelligence
 * abstraction that sits ACROSS the OpsOS kernel rather than beside it. It
 * observes, explains, predicts, and recommends. It NEVER performs work. It
 * NEVER modifies state. AI implementations plug into these interfaces later
 * (GPT, domain-specific planners, RL systems, in-house reasoning engines — all
 * implement the same contracts). The kernel owns WHAT intelligence means; AI
 * providers supply HOW it's produced.
 *
 * Layered dependency direction:
 *   `interfaces/ → application/ → domain/`
 *   `infrastructure/ → application/ → domain/`
 *   `domain/` depends ONLY on `@kernel/shared-kernel`.
 *
 * Public surface:
 *   - Domain:        IntelligenceGraph (+GraphNode/GraphEdge/kinds),
 *                    Explanation (+ExplanationEngine), Recommendation
 *                    (+RecommendationEngine), Prediction (+PredictionEngine),
 *                    Anomaly (+AnomalyDetector), LearningSignal
 *                    (+LearningSignalStore), AI contracts (Reasoner, Planner,
 *                    Predictor, Recommender, Optimizer, Evaluator,
 *                    MemoryProvider)
 *   - Application:   buildIntelligenceGraph, explainDecision,
 *                    generateRecommendations, predictOutcome, detectAnomalies
 *                    (each as a function + a use-case class)
 *   - Infrastructure: InMemoryIntelligenceGraph, DefaultExplanationEngine,
 *                    DefaultRecommendationEngine, DefaultPredictionEngine,
 *                    DefaultAnomalyDetector, InMemoryLearningSignalStore,
 *                    Mock* AI providers, createMockAIProviders,
 *                    IntelligenceFixedClock, createIntelligenceFramework
 *
 * Determinism guarantees (enforced):
 *   - NO `Date.now()` / `Math.random()` anywhere.
 *   - All time via injected `RuntimeClock` (default `IntelligenceFixedClock`
 *     at 0) or `context.now` / caller-supplied `now`.
 *   - All mock / default engines are deterministic (rule-based, heuristic,
 *     seeded by `hashSeed`).
 *   - Identical inputs → identical outputs, byte-for-byte.
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
