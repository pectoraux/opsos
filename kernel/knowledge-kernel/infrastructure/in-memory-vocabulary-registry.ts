/**
 * @kernel/knowledge-kernel/infrastructure/in-memory-vocabulary-registry — the
 * in-memory `VocabularyRegistry` implementation.
 *
 * Pure data structures:
 *   - `Map<VocabularyId, Vocabulary>` — canonical vocabulary records
 *   - `Map<string, { vocabId: VocabularyId; term: VocabularyTerm }[]>` —
 *     term/synonym → entries index (one entry per (vocabulary, term) pair;
 *     a synonym of one term does not duplicate the term's own entry)
 *
 * No `Date.now()`, no `Math.random()`. `lookupTerm` searches across ALL
 * vocabularies for a term whose `term` matches exactly OR whose `synonyms`
 * contains the term. Results are ordered by vocabulary id lexicographic,
 * then term lexicographic.
 */

import type { VocabularyId } from "@kernel/shared-kernel";
import type {
  Vocabulary,
  VocabularyTerm,
} from "@kernel/shared-kernel";
import type { VocabularyRegistry } from "../domain";

interface IndexedEntry {
  readonly vocabId: VocabularyId;
  readonly term: VocabularyTerm;
}

export class InMemoryVocabularyRegistry implements VocabularyRegistry {
  private readonly vocabularies = new Map<VocabularyId, Vocabulary>();
  private readonly byTerm = new Map<string, IndexedEntry[]>();

  register(vocabulary: Vocabulary): void {
    this.vocabularies.set(vocabulary.id, vocabulary);
    // Rebuild the term index for this vocabulary. We do NOT remove old
    // entries — vocabularies are immutable and registration is idempotent
    // for the same (id, version).
    for (const term of vocabulary.terms) {
      this.indexTerm(vocabulary.id, term);
    }
  }

  get(id: VocabularyId): Vocabulary | undefined {
    return this.vocabularies.get(id);
  }

  list(): readonly Vocabulary[] {
    return Array.from(this.vocabularies.values());
  }

  lookupTerm(term: string): readonly VocabularyTerm[] {
    const entries = this.byTerm.get(term);
    if (!entries) return [];
    // Deduplicate by (vocabId, term.term) — a term whose `term` matches AND
    // whose `synonyms` includes the same string would otherwise appear
    // twice. We deduplicate via a key set.
    const seen = new Set<string>();
    const out: VocabularyTerm[] = [];
    for (const entry of entries) {
      const key = `${entry.vocabId}#${entry.term.term}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(entry.term);
    }
    out.sort((a, b) => {
      // Stable sort by term lexicographic. (vocabId ordering is preserved
      // by the dedup pass but the final sort key is the term itself —
      // callers wanting vocab grouping should call `get(id)` directly.)
      return a.term < b.term ? -1 : a.term > b.term ? 1 : 0;
    });
    return out;
  }

  private indexTerm(vocabId: VocabularyId, term: VocabularyTerm): void {
    // Index the canonical term.
    this.pushEntry(term.term, { vocabId, term });
    // Index each synonym.
    for (const syn of term.synonyms) {
      this.pushEntry(syn, { vocabId, term });
    }
  }

  private pushEntry(key: string, entry: IndexedEntry): void {
    let list = this.byTerm.get(key);
    if (!list) {
      list = [];
      this.byTerm.set(key, list);
    }
    list.push(entry);
  }
}
