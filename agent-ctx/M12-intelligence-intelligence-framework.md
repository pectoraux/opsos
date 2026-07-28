# Work Record — M12-intelligence

**Task ID:** M12-intelligence
**Agent:** intelligence-framework
**Scope:** Build the Operational Intelligence Framework (IntelligenceGraph, ExplanationEngine, RecommendationEngine, PredictionEngine, AnomalyDetector, LearningSignal, AI contracts + deterministic mock implementations) under `kernel/intelligence/`.

## Prior context read
- `worklog.md` (M1–M11, FROZEN) — confirmed layering/determinism conventions and the conformance-module pattern as the closest structural analogue.
- `kernel/shared-kernel/interfaces/index.ts` + `domain/index.ts` — Result, KernelError, branded IDs, value objects, `RuntimeClock` / `RandomSource` ports, `hashSeed` / `mulberry32`, `FixedClock`, canonical primitives.
- `kernel/shared-kernel/domain/ports/runtime-clock.ts` + `random-source.ts` — clock + seeded-random ports.
- `kernel/conformance/*` — mirrored barrel/use-case/infrastructure patterns.

## Decisions (key)
- Intelligence module depends ONLY on `@kernel/shared-kernel`. Defines its OWN GraphNode/GraphEdge + explanation/recommendation/prediction/anomaly types (structurally compatible with kernel primitives, self-contained) — per the spec, NOT imported from other kernel modules.
- `Evidence` (named) was renamed to `ExplanationEvidence` to avoid a name collision with the shared-kernel knowledge primitive `Evidence` (the Explanation contract inlines that type, so the rename is contract-compatible). `Recommendation` is a spec-mandated export and intentionally overlaps with the shared-kernel operational `Recommendation` primitive (spec-endorsed "self-contained" approach).
- The default `PredictionEngine` is a DETERMINISTIC MOCK (moving average / linear extrapolation / rate extrapolation) — NO ML. `confidence` is a data-availability proxy, not a statistical claim.
- The kernel STORES learning signals but NEVER trains models (`InMemoryLearningSignalStore` is an append-only journal).
- `createIntelligenceFramework()` wires a shared `InMemoryIntelligenceGraph` + `InMemoryLearningSignalStore` + `RuntimeClock` (default `IntelligenceFixedClock` at 0) across all engines + mock AI providers.
- Determinism: NO `Date.now()` / `Math.random()` anywhere (verified by grep — only JSDoc mentions). All time via injected `RuntimeClock` or caller `now`.

## Files created (24)
- domain/ (8): intelligence-graph, explanation, recommendation, prediction, anomaly, learning-signal, ai-contracts, index
- application/ (6): build-intelligence-graph, explain-decision, generate-recommendations, predict-outcome, detect-anomalies, index
- infrastructure/ (8): in-memory-intelligence-graph, default-explanation-engine, default-recommendation-engine, default-prediction-engine, default-anomaly-detector, in-memory-learning-signal-store, mock-ai-providers, index
- interfaces/index.ts, index.ts (root)

## Verification
- `bunx tsc --noEmit 2>&1 | grep intelligence` → empty.
- `bunx tsc --noEmit 2>&1 | grep -v skills/ | head` → empty. Full tsc exit 0.
- Inline sanity run (not a test file): graph build + findPath (forward path found, reverse correctly empty), explanation (templated rationale + graph-derived evidence), recommendations (5 sorted by priority), prediction (moving-average n=4), anomalies (unexpected-retries + unusual-event-sequence), learning aggregate (count/avgConfidence/per-metric avg-min-max), mock AI reasoner — all deterministic (byte-identical across two fresh framework instances).
