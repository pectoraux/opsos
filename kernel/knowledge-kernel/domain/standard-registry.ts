/**
 * @kernel/knowledge-kernel/domain/standard-registry — the StandardRegistry
 * PORT.
 *
 * A `Standard` is a recognized normative document — ISO, OSHA, ASTM, EN,
 * etc. — with a category (quality, safety, environmental, operational,
 * technical), a code, and a list of requirements. Standards are universal
 * across operational industries. The Standard Registry owns the canonical
 * `Standard` record linked back to its `KnowledgeItem` parent (which carries
 * applicability + provenance + version).
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`.
 */

import type { StandardId } from "@kernel/shared-kernel";
import type { Standard, StandardCategory } from "@kernel/shared-kernel";

/**
 * The StandardRegistry PORT.
 */
export interface StandardRegistry {
  /** Registers (or replaces) a standard record. */
  register(standard: Standard): void;
  /** Returns the standard record, or `undefined` if unknown. */
  get(id: StandardId): Standard | undefined;
  /** Returns all standards, sorted by id lexicographic. */
  list(): readonly Standard[];
  /**
   * Returns all standards of the given category, sorted by id lexicographic.
   */
  listByCategory(category: StandardCategory): readonly Standard[];
  /**
   * Returns all standards whose `code` matches exactly (case-sensitive),
   * sorted by id lexicographic.
   */
  listByCode(code: string): readonly Standard[];
}
