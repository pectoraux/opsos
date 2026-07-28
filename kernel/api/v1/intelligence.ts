/**
 * @kernel/api/v1 — INTELLIGENCE public surface (FROZEN).
 *
 * The Operational Intelligence Framework: sits ACROSS the kernel, observing,
 * explaining, predicting, and recommending. Never performs work. Never modifies
 * state. AI providers implement the contracts; the kernel owns what intelligence
 * means (ADR-0021).
 */

// Intelligence graph
export type {
  GraphNodeKind,
  GraphEdgeKind,
  GraphNode,
  GraphEdge,
  IntelligenceGraph,
} from "@kernel/intelligence";

// Explanation
export type {
  ExplanationKind,
  AlternativePath,
  ExplanationEvidence,
  ExplanationProvenance,
  Explanation,
  ExplanationEngine,
} from "@kernel/intelligence";

// Recommendation
export type {
  RecommendationCategory,
  Recommendation as IntelligenceRecommendation,
  RecommendationEngine,
} from "@kernel/intelligence";

// Prediction
export type {
  PredictionMetric,
  Prediction,
  PredictionEngine,
} from "@kernel/intelligence";

// Anomaly
export type {
  AnomalyKind,
  AnomalySeverity,
  Anomaly,
  AnomalyDetector,
} from "@kernel/intelligence";

// Learning signals
export type {
  LearningSignal,
  LearningSignalStore,
  LearningSignalAggregate,
} from "@kernel/intelligence";

// AI contracts
export type {
  Reasoner,
  Planner,
  Predictor,
  Recommender,
  Optimizer,
  Evaluator,
  MemoryProvider,
} from "@kernel/intelligence";

// Application
export { buildIntelligenceGraph } from "@kernel/intelligence";
export { explainDecision } from "@kernel/intelligence";
export { generateRecommendations } from "@kernel/intelligence";
export { predictOutcome } from "@kernel/intelligence";
export { detectAnomalies } from "@kernel/intelligence";

// Infrastructure
export {
  InMemoryIntelligenceGraph,
  DefaultExplanationEngine,
  DefaultRecommendationEngine,
  DefaultPredictionEngine,
  DefaultAnomalyDetector,
  InMemoryLearningSignalStore,
  MockReasoner,
  MockPlanner,
  MockPredictor,
  MockRecommender,
  MockOptimizer,
  MockEvaluator,
  MockMemoryProvider,
  createMockAIProviders,
  createIntelligenceFramework,
} from "@kernel/intelligence";
