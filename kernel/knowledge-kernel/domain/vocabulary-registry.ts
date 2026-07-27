/**
 * @kernel/knowledge-kernel/domain/vocabulary-registry — the VocabularyRegistry
 * PORT.
 *
 * A `Vocabulary` is a controlled glossary — a list of `VocabularyTerm`s
 * (term, definition, synonyms, optional schemaRef). The Vocabulary Registry
 * owns the canonical `Vocabulary` record and provides cross-vocabulary term
 * lookup by exact term or synonym match.
 *
 * Vocabularies are universal across operational industries: a cleaning
 * vocabulary defines "biofilm", "disinfection", "sterilisation"; a medical
 * vocabulary defines "diagnosis", "contraindication", "dosage".
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`.
 */

import type { VocabularyId } from "@kernel/shared-kernel";
import type { Vocabulary, VocabularyTerm } from "@kernel/shared-kernel";

/**
 * The VocabularyRegistry PORT.
 */
export interface VocabularyRegistry {
  /** Registers (or replaces) a vocabulary record. */
  register(vocabulary: Vocabulary): void;
  /** Returns the vocabulary record, or `undefined` if unknown. */
  get(id: VocabularyId): Vocabulary | undefined;
  /** Returns all registered vocabularies (insertion order). */
  list(): readonly Vocabulary[];
  /**
   * Searches across ALL registered vocabularies for a term whose `term`
   * matches `term` exactly (case-sensitive) OR whose `synonyms` contains
   * `term`. Returns the matching `VocabularyTerm`s, ordered by vocabulary id
   * lexicographic, then by term lexicographic (deterministic). Returns `[]`
   * if no match.
   */
  lookupTerm(term: string): readonly VocabularyTerm[];
}
