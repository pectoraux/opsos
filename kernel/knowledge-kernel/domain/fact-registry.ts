/**
 * @kernel/knowledge-kernel/domain/fact-registry — the FactRegistry PORT.
 *
 * A `Fact` is a declarative statement about a subject
 * (e.g. "Marble is damaged by acidic chemicals"). Facts are universal
 * across operational industries — chemistry, medicine, engineering, food
 * safety, construction. The Fact Registry is the kernel's canonical
 * triple-store-ish lookup: `(subject, predicate, object)` with confidence.
 *
 * The Fact Registry is the layer the compiler / coordination / resource
 * kernels call when they ask "what do we know about subject X?" or "is it
 * true that subject X has property Y?". Facts are linked back to their
 * `KnowledgeItem` parent (the canonical record carrying provenance +
 * applicability + version).
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`.
 */

import type { FactId, KnowledgeItemId } from "@kernel/shared-kernel";
import type { Fact } from "@kernel/shared-kernel";

/**
 * The FactRegistry PORT.
 */
export interface FactRegistry {
  /** Registers (or replaces) a fact record. */
  register(fact: Fact): void;
  /** Returns the fact record, or `undefined` if unknown. */
  get(id: FactId): Fact | undefined;
  /**
   * Returns all facts whose `subject.kind === kind` AND `subject.id === id`,
   * sorted by confidence DESC, then id lexicographic ASC.
   */
  listBySubject(kind: string, id: string): readonly Fact[];
  /**
   * Returns all facts whose `predicate` matches exactly, sorted by
   * confidence DESC, then id lexicographic ASC.
   */
  listByPredicate(predicate: string): readonly Fact[];
  /**
   * Returns all facts linked to the given knowledge item, sorted by
   * confidence DESC, then id lexicographic ASC.
   */
  listByKnowledgeItem(itemId: KnowledgeItemId): readonly Fact[];
}
