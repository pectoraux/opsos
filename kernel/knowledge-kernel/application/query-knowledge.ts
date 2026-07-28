/**
 * @kernel/knowledge-kernel/application/query-knowledge — the main query
 * use-case. Wraps the `KnowledgeQueryEngine` and returns a comprehensive
 * knowledge view for a (subjectKind, subjectId) pair.
 *
 * Other kernels (compiler, coordination, resource) typically need MORE than
 * one slice of knowledge at a time: when planning a task on subject X, they
 * need the applicable SOPs, the regulations, the facts, the guidelines, AND
 * a compliance snapshot — all in one round-trip. This use-case bundles
 * those into a single `QueryKnowledgeResult`.
 *
 * The use-case is a thin orchestration layer: it delegates every lookup to
 * the `KnowledgeQueryEngine`. The engine is the source of truth for query
 * semantics; the use-case is the protocol-facing entry point.
 *
 * Determinism rule: identical inputs + identical engine → identical
 * outputs. No `Date.now()`, no `Math.random()`. All results sorted by the
 * engine's deterministic order (confidence DESC, then id lexicographic
 * ASC).
 */

import type {
  KnowledgeItem,
  Procedure,
  Regulation,
  Fact,
  Guideline,
} from "@kernel/shared-kernel";
import type {
  KnowledgeQueryEngine,
  ComplianceResult,
} from "../domain";

/**
 * The input to `QueryKnowledge.execute`. Pure data.
 */
export interface QueryKnowledgeInput {
  readonly subjectKind: string;
  readonly subjectId: string;
  /** Optional applicability tag filter. */
  readonly tags?: readonly string[];
  /**
   * Optional jurisdiction for regulation / compliance filtering. When
   * omitted, `regulations` includes all jurisdictions (the caller filters
   * further if needed); `compliance` is computed for the empty-jurisdiction
   * slice (i.e., no regulations matched → trivially compliant).
   */
  readonly jurisdiction?: string;
  /** Clock-sourced epoch-millis. Defaults to `0` (pure-data query). */
  readonly now?: number;
}

/**
 * The result of `QueryKnowledge.execute`. A comprehensive knowledge view.
 */
export interface QueryKnowledgeResult {
  /** Active, non-superseded knowledge items applicable to the subject. */
  readonly items: readonly KnowledgeItem[];
  /** Procedures whose parent knowledge item applies to the subject. */
  readonly procedures: readonly Procedure[];
  /**
   * Regulations whose parent knowledge item applies to the subject. When
   * `jurisdiction` is supplied, filtered to that jurisdiction.
   */
  readonly regulations: readonly Regulation[];
  /** Facts whose subject matches (subjectKind, subjectId). */
  readonly facts: readonly Fact[];
  /** Guidelines whose parent knowledge item applies to the subject. */
  readonly guidelines: readonly Guideline[];
  /**
   * Compliance snapshot for the subject in `jurisdiction`. When
   * `jurisdiction` is omitted, this is a no-op result with empty matches.
   */
  readonly compliance: ComplianceResult;
}

/**
 * The use-case PORT.
 */
export interface QueryKnowledge {
  execute(input: QueryKnowledgeInput): QueryKnowledgeResult;
}

/**
 * Default implementation.
 */
export class QueryKnowledgeUseCase implements QueryKnowledge {
  constructor(private readonly engine: KnowledgeQueryEngine) {}

  execute(input: QueryKnowledgeInput): QueryKnowledgeResult {
    const now = input.now ?? 0;
    const items = this.engine.lookup(
      input.subjectKind,
      input.subjectId,
      input.tags,
      now
    );
    const procedures = this.engine.lookupProcedures(
      input.subjectKind,
      input.subjectId,
      now
    );
    const regulations = this.engine.lookupRegulations(
      input.subjectKind,
      input.subjectId,
      input.jurisdiction,
      now
    );
    const facts = this.engine.lookupFacts(
      input.subjectKind,
      input.subjectId,
      now
    );
    const guidelines = this.engine.lookupGuidelines(
      input.subjectKind,
      input.subjectId,
      now
    );
    const compliance = input.jurisdiction
      ? this.engine.checkCompliance(
          input.subjectKind,
          input.subjectId,
          input.jurisdiction,
          now
        )
      : EMPTY_COMPLIANCE;
    return {
      items,
      procedures,
      regulations,
      facts,
      guidelines,
      compliance,
    };
  }
}

/**
 * A canonical empty compliance result — returned when no jurisdiction is
 * supplied. Reused (not re-allocated) for determinism / efficiency.
 */
const EMPTY_COMPLIANCE: ComplianceResult = {
  compliant: true,
  matchedRegulations: [],
  violations: [],
};
