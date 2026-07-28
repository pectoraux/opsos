/**
 * @kernel/knowledge-kernel — public surface.
 *
 * The Knowledge Kernel — the universal operational knowledge subsystem.
 * OpsOS knows how to execute, coordinate, and allocate, but it doesn't know
 * *why*. Knowledge (SOPs, regulations, safety procedures, best practices,
 * material compatibility, medical guidelines, building codes, hazard
 * classifications) is universal across every operational industry. Protocols
 * REGISTER knowledge artifacts; the kernel owns storage, versioning,
 * provenance, confidence, and applicability.
 *
 * The kernel REALIZES the 14 new M8 knowledge primitives (KnowledgeItem,
 * Fact, Evidence, Source, Procedure, Standard, Regulation, Guideline,
 * Ontology, Taxonomy, Vocabulary, Measurement, Hypothesis, Confidence) with
 * full registry behaviour + a query engine that the compiler, coordination,
 * and resource kernels call.
 *
 * Layered dependency direction:
 *   `interfaces/ → application/ → domain/`
 *   `infrastructure/ → application/ → domain/`
 *   `domain/` depends ONLY on `@kernel/shared-kernel`.
 *
 * Public surface:
 *   - Ports (14):   SourceRegistry, EvidenceRegistry, KnowledgeRegistry,
 *                    FactRegistry, ProcedureRegistry, StandardRegistry,
 *                    RegulationRegistry, GuidelineRegistry, OntologyRegistry,
 *                    TaxonomyRegistry, VocabularyRegistry, MeasurementRegistry,
 *                    HypothesisRegistry, KnowledgeQueryEngine
 *   - Application:  RegisterKnowledge + SupersedeKnowledge + QueryKnowledge
 *                    use-cases (+ UseCase classes)
 *   - Infrastructure: 13 in-memory registries + InMemoryKnowledgeQueryEngine +
 *                      InMemoryKnowledgeKernel bundle +
 *                      createInMemoryKnowledgeKernel() helper
 *
 * Determinism guarantees (enforced):
 *   - NO `Date.now()` / `Math.random()` anywhere in this module.
 *   - All time flows through the `now` argument.
 *   - All registries are pure data structures.
 *   - Query results sorted by confidence DESC, then id lexicographic ASC
 *     (or by severity DESC for compliance matchedRegulations).
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
