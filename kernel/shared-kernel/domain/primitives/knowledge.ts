/**
 * @kernel/shared-kernel/domain/primitives/knowledge — the knowledge-kernel
 * canonical primitives introduced in M8.
 *
 *   KnowledgeItem · Fact · Evidence · Source · Procedure · Standard
 *   · Regulation · Guideline · Ontology · Taxonomy · Vocabulary
 *   · Measurement · Hypothesis · Confidence
 *
 * These are universal operational knowledge concepts. Domain-independent.
 * No industry-specific fields. Protocols REGISTER knowledge artifacts; the
 * kernel owns the storage, versioning, provenance, confidence, and
 * applicability model.
 */

import type {
  KnowledgeItemId,
  FactId,
  EvidenceId,
  SourceId,
  ProcedureId,
  StandardId,
  RegulationId,
  GuidelineId,
  OntologyId,
  TaxonomyId,
  VocabularyId,
  MeasurementId,
  HypothesisId,
  TenantId,
} from "../identifiers";
import type {
  UnknownRecord,
  Constraint,
  PredicateSpec,
  ProvenanceRef,
  SchemaRef,
} from "../value-objects";

// ── Confidence ──────────────────────────────────────────────────────────────

/** Caller-supplied confidence in [0, 1]. Universal across all knowledge. */
export type Confidence = number;

// ── Source ──────────────────────────────────────────────────────────────────

export type SourceType =
  | "regulation"
  | "standard"
  | "manual"
  | "sop"
  | "best-practice"
  | "training"
  | "research"
  | "manufacturer"
  | "authority"
  | "internal";

/** The origin of a piece of knowledge — who/what authored it. */
export interface Source {
  readonly id: SourceId;
  readonly type: SourceType;
  readonly title: string;
  readonly issuer?: string;
  readonly url?: string;
  readonly version?: string;
  readonly publishedAt?: number;
  readonly effectiveAt?: number;
  readonly expiresAt?: number;
  readonly jurisdiction?: string;
}

// ── Evidence ────────────────────────────────────────────────────────────────

export type EvidenceType = "document" | "citation" | "test" | "observation" | "measurement" | "expert";

/** Evidence substantiating a fact or procedure. */
export interface Evidence {
  readonly id: EvidenceId;
  readonly sourceId: SourceId;
  readonly type: EvidenceType;
  readonly description: string;
  readonly reference?: string;
  readonly confidence: Confidence;
}

// ── KnowledgeItem (the base) ────────────────────────────────────────────────

export type KnowledgeKind =
  | "fact"
  | "procedure"
  | "standard"
  | "regulation"
  | "guideline"
  | "rule"
  | "constraint";

export type KnowledgeStatus = "draft" | "active" | "superseded" | "retired";

/** Applicability — when/where this knowledge applies. Serializable. */
export interface Applicability {
  readonly subjectKind?: string;
  readonly subjectId?: string;
  readonly conditions: readonly PredicateSpec[];
  readonly tags: readonly string[];
}

/**
 * The base knowledge item. Every knowledge artifact (fact, procedure,
 * standard, regulation, guideline, rule, constraint) is a KnowledgeItem with
 * a `kind` discriminator. Immutable per version; versioned + provenanced.
 */
export interface KnowledgeItem {
  readonly id: KnowledgeItemId;
  readonly kind: KnowledgeKind;
  readonly tenantId: TenantId;
  readonly title: string;
  readonly description?: string;
  readonly version: number;
  readonly status: KnowledgeStatus;
  readonly applicability: Applicability;
  readonly evidence: readonly Evidence[];
  readonly confidence: Confidence;
  readonly provenance: ProvenanceRef;
  readonly ownerProtocolId?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly supersededBy?: KnowledgeItemId;
  readonly metadata: UnknownRecord;
}

// ── Fact ────────────────────────────────────────────────────────────────────

/** A declarative fact (e.g. "Marble is damaged by acidic chemicals"). */
export interface Fact {
  readonly id: FactId;
  readonly knowledgeItemId: KnowledgeItemId;
  readonly subject: { readonly kind: string; readonly id: string };
  readonly predicate: string;
  readonly object: UnknownRecord;
  readonly confidence: Confidence;
}

// ── Procedure (SOP) ─────────────────────────────────────────────────────────

export interface ProcedureStep {
  readonly id: string;
  readonly order: number;
  readonly title: string;
  readonly description?: string;
  readonly materials: readonly string[];
  readonly hazards: readonly string[];
  readonly qualityChecks: readonly string[];
  readonly durationEstimateMs?: number;
  readonly constraints: readonly Constraint[];
}

/** A Standard Operating Procedure. */
export interface Procedure {
  readonly id: ProcedureId;
  readonly knowledgeItemId: KnowledgeItemId;
  readonly steps: readonly ProcedureStep[];
  readonly requiredMaterials: readonly string[];
  readonly hazards: readonly string[];
  readonly qualityChecks: readonly string[];
  readonly durationEstimateMs?: number;
}

// ── Standard ────────────────────────────────────────────────────────────────

export type StandardCategory = "quality" | "safety" | "environmental" | "operational" | "technical";

/** A recognized standard (e.g. ISO, OSHA). */
export interface Standard {
  readonly id: StandardId;
  readonly knowledgeItemId: KnowledgeItemId;
  readonly category: StandardCategory;
  readonly code: string;
  readonly requirements: readonly string[];
  readonly measurementCriteria?: UnknownRecord;
}

// ── Regulation ──────────────────────────────────────────────────────────────

export type RegulationSeverity = "info" | "advisory" | "mandatory" | "prohibited";

/** A regulation with legal force. */
export interface Regulation {
  readonly id: RegulationId;
  readonly knowledgeItemId: KnowledgeItemId;
  readonly jurisdiction: string;
  readonly severity: RegulationSeverity;
  readonly code: string;
  readonly requirements: readonly string[];
  readonly penalties?: UnknownRecord;
}

// ── Guideline ───────────────────────────────────────────────────────────────

/** A best-practice guideline (advisory, not mandatory). */
export interface Guideline {
  readonly id: GuidelineId;
  readonly knowledgeItemId: KnowledgeItemId;
  readonly recommendation: string;
  readonly rationale?: string;
  readonly priority: number;
}

// ── Ontology ────────────────────────────────────────────────────────────────

export interface OntologyNode {
  readonly id: string;
  readonly label: string;
  readonly parentId?: string;
  readonly attributes: UnknownRecord;
}

/** A domain ontology — entities + relationships. */
export interface Ontology {
  readonly id: OntologyId;
  readonly tenantId: TenantId;
  readonly name: string;
  readonly nodes: readonly OntologyNode[];
  readonly version: number;
}

// ── Taxonomy ────────────────────────────────────────────────────────────────

export interface TaxonomyNode {
  readonly id: string;
  readonly label: string;
  readonly parentId?: string;
  readonly code?: string;
}

/** A classification taxonomy. */
export interface Taxonomy {
  readonly id: TaxonomyId;
  readonly tenantId: TenantId;
  readonly name: string;
  readonly root: TaxonomyNode;
  readonly version: number;
}

// ── Vocabulary ──────────────────────────────────────────────────────────────

export interface VocabularyTerm {
  readonly term: string;
  readonly definition: string;
  readonly synonyms: readonly string[];
  readonly schemaRef?: SchemaRef;
}

/** A controlled vocabulary / glossary. */
export interface Vocabulary {
  readonly id: VocabularyId;
  readonly tenantId: TenantId;
  readonly name: string;
  readonly terms: readonly VocabularyTerm[];
  readonly version: number;
}

// ── Measurement ─────────────────────────────────────────────────────────────

export type MeasurementUnit = string;

/** A typed measurement definition (e.g. "surface area in m²"). */
export interface Measurement {
  readonly id: MeasurementId;
  readonly knowledgeItemId: KnowledgeItemId;
  readonly metric: string;
  readonly unit: MeasurementUnit;
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly precision?: number;
  readonly schemaRef?: SchemaRef;
}

// ── Hypothesis ──────────────────────────────────────────────────────────────

export type HypothesisStatus = "proposed" | "testing" | "confirmed" | "refuted" | "retired";

/** A hypothesis — a testable claim that may become a fact. */
export interface Hypothesis {
  readonly id: HypothesisId;
  readonly tenantId: TenantId;
  readonly statement: string;
  readonly status: HypothesisStatus;
  readonly confidence: Confidence;
  readonly evidence: readonly Evidence[];
  readonly testingProcedureId?: ProcedureId;
  readonly proposedAt: number;
  readonly resolvedAt?: number;
}
