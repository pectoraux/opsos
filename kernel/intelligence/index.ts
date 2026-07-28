/**
 * @kernel/intelligence — root entry. Re-exports the public interfaces barrel
 * so `import { ... } from "@kernel/intelligence"` resolves the full Operational
 * Intelligence Framework contract.
 *
 * The framework sits ACROSS the kernel: it observes (IntelligenceGraph),
 * explains (ExplanationEngine), predicts (PredictionEngine), recommends
 * (RecommendationEngine), and detects anomalies (AnomalyDetector). It never
 * performs work and never modifies state. AI providers implement the contracts
 * in `domain/ai-contracts.ts` and are injected at the edge; the kernel never
 * calls AI directly.
 */
export * from "./interfaces";
