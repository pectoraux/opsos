/**
 * @kernel/knowledge-kernel/domain/knowledge-query-engine — the
 * KnowledgeQueryEngine PORT. THE query interface the compiler + coordination
 * + resource kernels call.
 *
 * The Knowledge Kernel is the universal operational knowledge subsystem.
 * Other kernels ask it:
 *   - "what knowledge applies to subject X with tags T?"     → lookup
 *   - "what's the SOP for subject X?"                        → lookupProcedures
 *   - "what regulations apply to subject X in jurisdiction Y?" → lookupRegulations
 *   - "what facts do we know about subject X?"               → lookupFacts
 *   - "what guidelines apply to subject X?"                  → lookupGuidelines
 *   - "is subject X compliant in jurisdiction Y?"            → checkCompliance
 *
 * The engine is a thin orchestration layer over the KnowledgeRegistry +
 * ProcedureRegistry + RegulationRegistry + FactRegistry + GuidelineRegistry.
 * It does NOT own state — it queries the registries and shapes the results.
 * This keeps the registries pure data structures and lets protocols swap in
 * alternative engines (e.g. one that interprets `Applicability.conditions`
 * predicates, which the default engine treats as advisory metadata).
 *
 * Constructor deps (the engine is constructed with all five registries):
 *   `{ registry: KnowledgeRegistry, procedures: ProcedureRegistry,
 *      regulations: RegulationRegistry, facts: FactRegistry,
 *      guidelines: GuidelineRegistry }`
 *
 * `now` defaults to `0` on every method (caller sources from clock; the
 * engine is usable without a clock for pure-data queries).
 *
 * Determinism rule: identical inputs + identical registries → identical
 * outputs. No `Date.now()`, no `Math.random()`. All results sorted by
 * confidence DESC, then id lexicographic ASC (the determinism anchor).
 */

import type {
  KnowledgeItem,
  Procedure,
  Regulation,
  Fact,
  Guideline,
  RegulationId,
  Evidence,
} from "@kernel/shared-kernel";
import type { KnowledgeRegistry } from "./knowledge-registry";
import type { ProcedureRegistry } from "./procedure-registry";
import type { RegulationRegistry } from "./regulation-registry";
import type { FactRegistry } from "./fact-registry";
import type { GuidelineRegistry } from "./guideline-registry";

/**
 * Constructor dependencies for the KnowledgeQueryEngine. The engine is
 * constructed with all five sibling registries; it owns no state of its own.
 */
export interface KnowledgeQueryEngineDeps {
  readonly registry: KnowledgeRegistry;
  readonly procedures: ProcedureRegistry;
  readonly regulations: RegulationRegistry;
  readonly facts: FactRegistry;
  readonly guidelines: GuidelineRegistry;
}

/**
 * A single compliance violation entry. The kernel cannot itself verify
 * whether a subject meets a regulation (it lacks subject-side observation);
 * instead it surfaces every requirement of every matched mandatory /
 * prohibited regulation as a `violation` — i.e., an obligation the caller
 * (compiler / coordination / resource kernel) MUST verify.
 */
export interface ComplianceViolation {
  readonly regulationId: RegulationId;
  readonly requirement: string;
}

/**
 * The result of `checkCompliance`. Pure data.
 *
 *   `compliant`            — `true` iff `violations` is empty.
 *   `matchedRegulations`   — every regulation applicable to the subject in
 *                            the jurisdiction, sorted by severity DESC
 *                            (prohibited → mandatory → advisory → info),
 *                            then id lexicographic.
 *   `violations`           — every requirement of every matched
 *                            `mandatory` or `prohibited` regulation, as a
 *                            `ComplianceViolation`. Empty when no such
 *                            regulations apply (hence compliant).
 */
export interface ComplianceResult {
  readonly compliant: boolean;
  readonly matchedRegulations: readonly Regulation[];
  readonly violations: readonly ComplianceViolation[];
}

/**
 * The KnowledgeQueryEngine PORT.
 *
 * Implementations MUST be pure functions of their inputs. `now` defaults to
 * `0` on every method (the caller should source from a clock; the engine is
 * usable without a clock for pure-data queries).
 */
export interface KnowledgeQueryEngine {
  /**
   * THE primary lookup. Returns every active, non-superseded
   * `KnowledgeItem` whose applicability matches `(subjectKind, subjectId)`
   * and (when supplied) every tag in `tags`. Returns items sorted by
   * confidence DESC, then id lexicographic ASC.
   */
  lookup(
    subjectKind: string,
    subjectId: string,
    tags?: readonly string[],
    now?: number
  ): readonly KnowledgeItem[];

  /**
   * Returns every `Procedure` whose parent `KnowledgeItem` is active and
   * applies to `(subjectKind, subjectId)`. Sorted by parent-item confidence
   * DESC, then procedure id lexicographic ASC.
   */
  lookupProcedures(
    subjectKind: string,
    subjectId: string,
    now?: number
  ): readonly Procedure[];

  /**
   * Returns every `Regulation` whose parent `KnowledgeItem` is active and
   * applies to `(subjectKind, subjectId)`. When `jurisdiction` is supplied,
   * further filters by `regulation.jurisdiction === jurisdiction`. Sorted by
   * parent-item confidence DESC, then regulation id lexicographic ASC.
   */
  lookupRegulations(
    subjectKind: string,
    subjectId: string,
    jurisdiction?: string,
    now?: number
  ): readonly Regulation[];

  /**
   * Returns every `Fact` whose `subject.kind === subjectKind` AND
   * `subject.id === subjectId`. Sorted by confidence DESC, then id
   * lexicographic ASC.
   */
  lookupFacts(
    subjectKind: string,
    subjectId: string,
    now?: number
  ): readonly Fact[];

  /**
   * Returns every `Guideline` whose parent `KnowledgeItem` is active and
   * applies to `(subjectKind, subjectId)`. Sorted by parent-item confidence
   * DESC, then guideline `priority` DESC, then id lexicographic ASC.
   */
  lookupGuidelines(
    subjectKind: string,
    subjectId: string,
    now?: number
  ): readonly Guideline[];

  /**
   * Checks compliance for `(subjectKind, subjectId)` in `jurisdiction`.
   * Returns the matched regulations (all applicable regulations in the
   * jurisdiction) plus a `violations` list enumerating every requirement of
   * every matched `mandatory` or `prohibited` regulation. `compliant` is
   * `true` iff `violations` is empty.
   *
   * The kernel cannot itself verify whether a subject meets a regulation —
   * it surfaces obligations. The caller (compiler / coordination / resource
   * kernel) is responsible for verifying each obligation against
   * subject-side observations.
   */
  checkCompliance(
    subjectKind: string,
    subjectId: string,
    jurisdiction: string,
    now?: number
  ): ComplianceResult;
}

/**
 * The evidence-carrying shape returned by `lookup` is just the
 * `KnowledgeItem` (which already carries its `evidence` array). Re-exported
 * here as a typedef for callers who want to name the lookup result.
 */
export type LookupResult = KnowledgeItem;

/**
 * Re-exported for type-narrowing in engine consumers. The Evidence type is
 * the same one carried by `KnowledgeItem.evidence`.
 */
export type { Evidence };
