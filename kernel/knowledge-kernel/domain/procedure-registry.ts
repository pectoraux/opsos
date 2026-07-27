/**
 * @kernel/knowledge-kernel/domain/procedure-registry — the ProcedureRegistry
 * PORT.
 *
 * A `Procedure` is a Standard Operating Procedure — the step-by-step
 * prescription of HOW to do something. Procedures are universal: cleaning,
 * medical triage, equipment maintenance, food prep, emergency response. The
 * Procedure Registry owns the canonical `Procedure` record (steps, required
 * materials, hazards, quality checks, duration estimate) linked back to its
 * `KnowledgeItem` parent (which carries applicability + provenance).
 *
 * The Coordination Kernel queries this registry when it asks:
 *   - "what's the SOP for subject X?"
 *   - "which procedures require material M?" (for material-compatibility
 *      checks during planning)
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`.
 */

import type { ProcedureId, KnowledgeItemId } from "@kernel/shared-kernel";
import type { Procedure } from "@kernel/shared-kernel";

/**
 * The ProcedureRegistry PORT.
 */
export interface ProcedureRegistry {
  /** Registers (or replaces) a procedure record. */
  register(procedure: Procedure): void;
  /** Returns the procedure record, or `undefined` if unknown. */
  get(id: ProcedureId): Procedure | undefined;
  /** Returns all procedures, sorted by id lexicographic. */
  list(): readonly Procedure[];
  /**
   * Returns all procedures linked to the given knowledge item, sorted by id
   * lexicographic.
   */
  listByKnowledgeItem(itemId: KnowledgeItemId): readonly Procedure[];
  /**
   * Returns all procedures whose `requiredMaterials` contains `material`
   * (case-sensitive, exact match), sorted by id lexicographic.
   */
  listByRequiredMaterial(material: string): readonly Procedure[];
}
