/**
 * @kernel/knowledge-kernel/infrastructure — barrel + InMemoryKnowledgeKernel
 * bundle + createInMemoryKnowledgeKernel() helper.
 *
 * The infrastructure layer of the Knowledge Kernel. Concrete in-memory
 * implementations of every port. Pure data structures; no `Date.now()`, no
 * `Math.random()`. Suitable for tests, deterministic replay, and as
 * reference implementations for protocol authors.
 *
 * Public surface:
 *   - InMemorySourceRegistry
 *   - InMemoryEvidenceRegistry
 *   - InMemoryKnowledgeRegistry            (THE key registry)
 *   - InMemoryFactRegistry
 *   - InMemoryProcedureRegistry
 *   - InMemoryStandardRegistry
 *   - InMemoryRegulationRegistry
 *   - InMemoryGuidelineRegistry
 *   - InMemoryOntologyRegistry
 *   - InMemoryTaxonomyRegistry
 *   - InMemoryVocabularyRegistry
 *   - InMemoryMeasurementRegistry
 *   - InMemoryHypothesisRegistry
 *   - InMemoryKnowledgeQueryEngine         (THE query engine)
 *   - InMemoryKnowledgeKernel (bundle interface)
 *   - createInMemoryKnowledgeKernel() (bundle helper)
 */

import { InMemorySourceRegistry } from "./in-memory-source-registry";
import { InMemoryEvidenceRegistry } from "./in-memory-evidence-registry";
import { InMemoryKnowledgeRegistry } from "./in-memory-knowledge-registry";
import { InMemoryFactRegistry } from "./in-memory-fact-registry";
import { InMemoryProcedureRegistry } from "./in-memory-procedure-registry";
import { InMemoryStandardRegistry } from "./in-memory-standard-registry";
import { InMemoryRegulationRegistry } from "./in-memory-regulation-registry";
import { InMemoryGuidelineRegistry } from "./in-memory-guideline-registry";
import { InMemoryOntologyRegistry } from "./in-memory-ontology-registry";
import { InMemoryTaxonomyRegistry } from "./in-memory-taxonomy-registry";
import { InMemoryVocabularyRegistry } from "./in-memory-vocabulary-registry";
import { InMemoryMeasurementRegistry } from "./in-memory-measurement-registry";
import { InMemoryHypothesisRegistry } from "./in-memory-hypothesis-registry";
import { InMemoryKnowledgeQueryEngine } from "./in-memory-knowledge-query-engine";

export { InMemorySourceRegistry } from "./in-memory-source-registry";
export { InMemoryEvidenceRegistry } from "./in-memory-evidence-registry";
export { InMemoryKnowledgeRegistry } from "./in-memory-knowledge-registry";
export { InMemoryFactRegistry } from "./in-memory-fact-registry";
export { InMemoryProcedureRegistry } from "./in-memory-procedure-registry";
export { InMemoryStandardRegistry } from "./in-memory-standard-registry";
export { InMemoryRegulationRegistry } from "./in-memory-regulation-registry";
export { InMemoryGuidelineRegistry } from "./in-memory-guideline-registry";
export { InMemoryOntologyRegistry } from "./in-memory-ontology-registry";
export { InMemoryTaxonomyRegistry } from "./in-memory-taxonomy-registry";
export { InMemoryVocabularyRegistry } from "./in-memory-vocabulary-registry";
export { InMemoryMeasurementRegistry } from "./in-memory-measurement-registry";
export { InMemoryHypothesisRegistry } from "./in-memory-hypothesis-registry";
export { InMemoryKnowledgeQueryEngine } from "./in-memory-knowledge-query-engine";

import type {
  Source,
  Evidence,
  KnowledgeItem,
  Fact,
  Procedure,
  Standard,
  Regulation,
  Guideline,
  Ontology,
  Taxonomy,
  Vocabulary,
  Measurement,
  Hypothesis,
} from "@kernel/shared-kernel";
import type { KnowledgeItemId } from "@kernel/shared-kernel";

/**
 * A convenience bundle of every in-memory knowledge-kernel component.
 *
 * Construct one per knowledge-kernel session and pass the components
 * individually to use-cases (`RegisterKnowledgeUseCase`,
 * `SupersedeKnowledgeUseCase`, `QueryKnowledgeUseCase`).
 *
 * The bundle pre-wires the `InMemoryKnowledgeQueryEngine` with the five
 * sibling registries it needs (knowledge, procedures, regulations, facts,
 * guidelines). The other registries (source, evidence, ontology, taxonomy,
 * vocabulary, measurement, hypothesis, standard) are NOT consumed by the
 * engine but are exposed here for direct use by protocols.
 *
 * Convenience methods (`registerSource`, `registerKnowledgeItem`,
 * `supersede`, `retire`, `confirmHypothesis`, `refuteHypothesis`) are thin
 * pass-throughs to the underlying registries — they do NOT replace the
 * application use-cases (which provide atomic multi-registry registration).
 * They exist for ergonomic single-line calls.
 */
export interface InMemoryKnowledgeKernel {
  readonly sources: InMemorySourceRegistry;
  readonly evidence: InMemoryEvidenceRegistry;
  readonly registry: InMemoryKnowledgeRegistry;
  readonly facts: InMemoryFactRegistry;
  readonly procedures: InMemoryProcedureRegistry;
  readonly standards: InMemoryStandardRegistry;
  readonly regulations: InMemoryRegulationRegistry;
  readonly guidelines: InMemoryGuidelineRegistry;
  readonly ontologies: InMemoryOntologyRegistry;
  readonly taxonomies: InMemoryTaxonomyRegistry;
  readonly vocabularies: InMemoryVocabularyRegistry;
  readonly measurements: InMemoryMeasurementRegistry;
  readonly hypotheses: InMemoryHypothesisRegistry;
  readonly engine: InMemoryKnowledgeQueryEngine;

  /** Convenience: registers a source. */
  registerSource(source: Source): void;
  /** Convenience: registers an evidence record. */
  registerEvidence(evidence: Evidence): void;
  /** Convenience: registers a knowledge item (the universal envelope). */
  registerKnowledgeItem(item: KnowledgeItem): void;
  /** Convenience: registers a fact. */
  registerFact(fact: Fact): void;
  /** Convenience: registers a procedure. */
  registerProcedure(procedure: Procedure): void;
  /** Convenience: registers a standard. */
  registerStandard(standard: Standard): void;
  /** Convenience: registers a regulation. */
  registerRegulation(regulation: Regulation): void;
  /** Convenience: registers a guideline. */
  registerGuideline(guideline: Guideline): void;
  /** Convenience: registers an ontology. */
  registerOntology(ontology: Ontology): void;
  /** Convenience: registers a taxonomy. */
  registerTaxonomy(taxonomy: Taxonomy): void;
  /** Convenience: registers a vocabulary. */
  registerVocabulary(vocabulary: Vocabulary): void;
  /** Convenience: registers a measurement. */
  registerMeasurement(measurement: Measurement): void;
  /** Convenience: registers a hypothesis. */
  registerHypothesis(hypothesis: Hypothesis): void;
  /** Convenience: marks an old knowledge item as superseded by a new one. */
  supersede(oldId: KnowledgeItemId, newId: KnowledgeItemId, now: number): void;
  /** Convenience: retires a knowledge item. */
  retire(id: KnowledgeItemId, now: number): void;
  /** Convenience: confirms a hypothesis with additional evidence. */
  confirmHypothesis(
    id: Hypothesis["id"],
    evidence: Evidence,
    now: number
  ): void;
  /** Convenience: refutes a hypothesis with additional evidence. */
  refuteHypothesis(
    id: Hypothesis["id"],
    evidence: Evidence,
    now: number
  ): void;
}

/**
 * Construct a fresh bundle of in-memory knowledge-kernel components. Each
 * component is a new instance with empty state. The query engine is wired
 * to the five sibling registries it consumes.
 */
export function createInMemoryKnowledgeKernel(): InMemoryKnowledgeKernel {
  const sources = new InMemorySourceRegistry();
  const evidence = new InMemoryEvidenceRegistry();
  const registry = new InMemoryKnowledgeRegistry();
  const facts = new InMemoryFactRegistry();
  const procedures = new InMemoryProcedureRegistry();
  const standards = new InMemoryStandardRegistry();
  const regulations = new InMemoryRegulationRegistry();
  const guidelines = new InMemoryGuidelineRegistry();
  const ontologies = new InMemoryOntologyRegistry();
  const taxonomies = new InMemoryTaxonomyRegistry();
  const vocabularies = new InMemoryVocabularyRegistry();
  const measurements = new InMemoryMeasurementRegistry();
  const hypotheses = new InMemoryHypothesisRegistry();
  const engine = new InMemoryKnowledgeQueryEngine({
    registry,
    procedures,
    regulations,
    facts,
    guidelines,
  });

  return {
    sources,
    evidence,
    registry,
    facts,
    procedures,
    standards,
    regulations,
    guidelines,
    ontologies,
    taxonomies,
    vocabularies,
    measurements,
    hypotheses,
    engine,
    registerSource: (source) => sources.register(source),
    registerEvidence: (ev) => evidence.register(ev),
    registerKnowledgeItem: (item) => registry.register(item),
    registerFact: (f) => facts.register(f),
    registerProcedure: (p) => procedures.register(p),
    registerStandard: (s) => standards.register(s),
    registerRegulation: (r) => regulations.register(r),
    registerGuideline: (g) => guidelines.register(g),
    registerOntology: (o) => ontologies.register(o),
    registerTaxonomy: (t) => taxonomies.register(t),
    registerVocabulary: (v) => vocabularies.register(v),
    registerMeasurement: (m) => measurements.register(m),
    registerHypothesis: (h) => hypotheses.register(h),
    supersede: (oldId, newId, now) => registry.supersede(oldId, newId, now),
    retire: (id, now) => registry.retire(id, now),
    confirmHypothesis: (id, ev, now) => hypotheses.confirm(id, ev, now),
    refuteHypothesis: (id, ev, now) => hypotheses.refute(id, ev, now),
  };
}
