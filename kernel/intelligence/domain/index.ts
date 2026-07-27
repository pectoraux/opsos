/**
 * @kernel/intelligence/domain — domain barrel.
 *
 * Re-exports every intelligence primitive and PORT so a single
 * `import { IntelligenceGraph, Explanation, ... } from "@kernel/intelligence/domain"`
 * resolves the full domain surface.
 *
 * Layering: `domain/` depends ONLY on `@kernel/shared-kernel` (for the
 * `RuntimeClock` type re-exported by `learning-signal`). It defines its OWN
 * graph node/edge types, explanation/recommendation/prediction/anomaly types,
 * and AI contracts — structurally compatible with kernel primitives but
 * self-contained, keeping the intelligence framework decoupled and
 * cross-cutting.
 */
export * from "./intelligence-graph";
export * from "./explanation";
export * from "./recommendation";
export * from "./prediction";
export * from "./anomaly";
export * from "./learning-signal";
export * from "./ai-contracts";
