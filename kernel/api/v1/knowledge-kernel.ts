/**
 * @kernel/api/v1 — KNOWLEDGE-KERNEL public surface (FROZEN).
 *
 * The Knowledge Kernel: owns universal operational knowledge (SOPs, regulations,
 * standards, guidelines, facts, procedures, ontologies, taxonomies, vocabularies,
 * measurements, hypotheses). Protocols register knowledge artifacts; the kernel
 * owns storage, versioning, provenance, confidence, and applicability (ADR-0017).
 */

// Ports — registries
export type { SourceRegistry } from "@kernel/knowledge-kernel";
export type { EvidenceRegistry } from "@kernel/knowledge-kernel";
export type {
  KnowledgeRegistry,
  KnowledgeQuery,
} from "@kernel/knowledge-kernel";
export type { FactRegistry } from "@kernel/knowledge-kernel";
export type { ProcedureRegistry } from "@kernel/knowledge-kernel";
export type { StandardRegistry } from "@kernel/knowledge-kernel";
export type { RegulationRegistry } from "@kernel/knowledge-kernel";
export type { GuidelineRegistry } from "@kernel/knowledge-kernel";
export type { OntologyRegistry } from "@kernel/knowledge-kernel";
export type { TaxonomyRegistry } from "@kernel/knowledge-kernel";
export type { VocabularyRegistry } from "@kernel/knowledge-kernel";
export type { MeasurementRegistry } from "@kernel/knowledge-kernel";
export type { HypothesisRegistry } from "@kernel/knowledge-kernel";

// Ports — query engine
export type {
  KnowledgeQueryEngine,
  KnowledgeQueryEngineDeps,
  ComplianceResult,
  ComplianceViolation,
  LookupResult,
} from "@kernel/knowledge-kernel";

// Application — use-cases
export type {
  RegisterKnowledge,
  RegisterKnowledgeInput,
  RegisterKnowledgeArtifact,
  RegisterKnowledgeResult,
  RegisterKnowledgeOutcome,
  RegisterKnowledgeDeps,
} from "@kernel/knowledge-kernel";
export { RegisterKnowledgeUseCase } from "@kernel/knowledge-kernel";

export type {
  SupersedeKnowledge,
  SupersedeKnowledgeInput,
  SupersedeKnowledgeResult,
  SupersedeKnowledgeOutcome,
} from "@kernel/knowledge-kernel";
export { SupersedeKnowledgeUseCase } from "@kernel/knowledge-kernel";

export type {
  QueryKnowledge,
  QueryKnowledgeInput,
  QueryKnowledgeResult,
} from "@kernel/knowledge-kernel";
export { QueryKnowledgeUseCase } from "@kernel/knowledge-kernel";

// Infrastructure
export {
  InMemorySourceRegistry,
  InMemoryEvidenceRegistry,
  InMemoryKnowledgeRegistry,
  InMemoryFactRegistry,
  InMemoryProcedureRegistry,
  InMemoryStandardRegistry,
  InMemoryRegulationRegistry,
  InMemoryGuidelineRegistry,
  InMemoryOntologyRegistry,
  InMemoryTaxonomyRegistry,
  InMemoryVocabularyRegistry,
  InMemoryMeasurementRegistry,
  InMemoryHypothesisRegistry,
  InMemoryKnowledgeQueryEngine,
  createInMemoryKnowledgeKernel,
} from "@kernel/knowledge-kernel";
export type { InMemoryKnowledgeKernel } from "@kernel/knowledge-kernel";
