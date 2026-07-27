/**
 * @kernel/knowledge-kernel/domain/guideline-registry — the GuidelineRegistry
 * PORT.
 *
 * A `Guideline` is a best-practice recommendation — advisory, not mandatory.
 * It carries a recommendation string, an optional rationale, and a priority
 * (numeric; higher = more important). Guidelines are universal across
 * operational industries.
 *
 * The Guideline Registry owns the canonical `Guideline` record linked back
 * to its `KnowledgeItem` parent (which carries applicability + provenance +
 * version).
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`.
 */

import type { GuidelineId, KnowledgeItemId } from "@kernel/shared-kernel";
import type { Guideline } from "@kernel/shared-kernel";

/**
 * The GuidelineRegistry PORT.
 */
export interface GuidelineRegistry {
  /** Registers (or replaces) a guideline record. */
  register(guideline: Guideline): void;
  /** Returns the guideline record, or `undefined` if unknown. */
  get(id: GuidelineId): Guideline | undefined;
  /** Returns all guidelines, sorted by id lexicographic. */
  list(): readonly Guideline[];
  /**
   * Returns all guidelines linked to the given knowledge item, sorted by
   * priority DESC, then id lexicographic ASC.
   */
  listByKnowledgeItem(itemId: KnowledgeItemId): readonly Guideline[];
}
