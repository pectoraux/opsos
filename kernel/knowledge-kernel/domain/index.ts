/**
 * @kernel/knowledge-kernel/domain — barrel.
 *
 * The domain layer of the Knowledge Kernel. Pure types + pure interfaces +
 * pure constants. Depends ONLY on `@kernel/shared-kernel`.
 *
 * Public surface (13 registries + 1 query engine):
 *   - SourceRegistry PORT
 *   - EvidenceRegistry PORT
 *   - KnowledgeRegistry PORT + KnowledgeQuery  (THE key registry)
 *   - FactRegistry PORT
 *   - ProcedureRegistry PORT
 *   - StandardRegistry PORT
 *   - RegulationRegistry PORT
 *   - GuidelineRegistry PORT
 *   - OntologyRegistry PORT
 *   - TaxonomyRegistry PORT
 *   - VocabularyRegistry PORT
 *   - MeasurementRegistry PORT
 *   - HypothesisRegistry PORT
 *   - KnowledgeQueryEngine PORT + KnowledgeQueryEngineDeps +
 *     ComplianceResult + ComplianceViolation + LookupResult
 *
 * Determinism guarantees (enforced):
 *   - NO `Date.now()` / `Math.random()` anywhere in this module.
 *   - All time flows through the `now` argument.
 *   - All registries are pure data structures.
 *   - Query results sorted by confidence DESC, then id lexicographic ASC.
 */

// ── Source ─────────────────────────────────────────────────────────────────
export type { SourceRegistry } from "./source-registry";

// ── Evidence ───────────────────────────────────────────────────────────────
export type { EvidenceRegistry } from "./evidence-registry";

// ── Knowledge item (THE key registry) ──────────────────────────────────────
export type {
  KnowledgeRegistry,
  KnowledgeQuery,
} from "./knowledge-registry";

// ── Fact ───────────────────────────────────────────────────────────────────
export type { FactRegistry } from "./fact-registry";

// ── Procedure ──────────────────────────────────────────────────────────────
export type { ProcedureRegistry } from "./procedure-registry";

// ── Standard ───────────────────────────────────────────────────────────────
export type { StandardRegistry } from "./standard-registry";

// ── Regulation ─────────────────────────────────────────────────────────────
export type { RegulationRegistry } from "./regulation-registry";

// ── Guideline ──────────────────────────────────────────────────────────────
export type { GuidelineRegistry } from "./guideline-registry";

// ── Ontology ───────────────────────────────────────────────────────────────
export type { OntologyRegistry } from "./ontology-registry";

// ── Taxonomy ───────────────────────────────────────────────────────────────
export type { TaxonomyRegistry } from "./taxonomy-registry";

// ── Vocabulary ─────────────────────────────────────────────────────────────
export type { VocabularyRegistry } from "./vocabulary-registry";

// ── Measurement ────────────────────────────────────────────────────────────
export type { MeasurementRegistry } from "./measurement-registry";

// ── Hypothesis ─────────────────────────────────────────────────────────────
export type { HypothesisRegistry } from "./hypothesis-registry";

// ── Query engine (THE query interface) ─────────────────────────────────────
export type {
  KnowledgeQueryEngine,
  KnowledgeQueryEngineDeps,
  ComplianceResult,
  ComplianceViolation,
  LookupResult,
} from "./knowledge-query-engine";
