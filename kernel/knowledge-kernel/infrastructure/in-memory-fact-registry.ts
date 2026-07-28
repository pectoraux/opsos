/**
 * @kernel/knowledge-kernel/infrastructure/in-memory-fact-registry — the
 * in-memory `FactRegistry` implementation.
 *
 * Pure data structures:
 *   - `Map<FactId, Fact>` — canonical fact records
 *   - `Map<string, Set<FactId>>` — `${subjectKind}#${subjectId}` → fact ids
 *   - `Map<string, Set<FactId>>` — predicate → fact ids
 *   - `Map<KnowledgeItemId, Set<FactId>>` — knowledge-item → fact ids
 *
 * No `Date.now()`, no `Math.random()`. `listBySubject` / `listByPredicate` /
 * `listByKnowledgeItem` return facts sorted by confidence DESC, then id
 * lexicographic ASC.
 */

import type { FactId, KnowledgeItemId } from "@kernel/shared-kernel";
import type { Fact } from "@kernel/shared-kernel";
import type { FactRegistry } from "../domain";

function subjectKey(kind: string, id: string): string {
  return `${kind}#${id}`;
}

export class InMemoryFactRegistry implements FactRegistry {
  private readonly facts = new Map<FactId, Fact>();
  private readonly bySubject = new Map<string, Set<FactId>>();
  private readonly byPredicate = new Map<string, Set<FactId>>();
  private readonly byKnowledgeItem = new Map<KnowledgeItemId, Set<FactId>>();

  register(fact: Fact): void {
    const prev = this.facts.get(fact.id);
    if (prev) {
      const oldSubjKey = subjectKey(prev.subject.kind, prev.subject.id);
      if (oldSubjKey !== subjectKey(fact.subject.kind, fact.subject.id)) {
        const oldSet = this.bySubject.get(oldSubjKey);
        if (oldSet) oldSet.delete(prev.id);
      }
      if (prev.predicate !== fact.predicate) {
        const oldSet = this.byPredicate.get(prev.predicate);
        if (oldSet) oldSet.delete(prev.id);
      }
      if (prev.knowledgeItemId !== fact.knowledgeItemId) {
        const oldSet = this.byKnowledgeItem.get(prev.knowledgeItemId);
        if (oldSet) oldSet.delete(prev.id);
      }
    }
    this.facts.set(fact.id, fact);

    let s = this.bySubject.get(subjectKey(fact.subject.kind, fact.subject.id));
    if (!s) {
      s = new Set();
      this.bySubject.set(subjectKey(fact.subject.kind, fact.subject.id), s);
    }
    s.add(fact.id);

    let p = this.byPredicate.get(fact.predicate);
    if (!p) {
      p = new Set();
      this.byPredicate.set(fact.predicate, p);
    }
    p.add(fact.id);

    let k = this.byKnowledgeItem.get(fact.knowledgeItemId);
    if (!k) {
      k = new Set();
      this.byKnowledgeItem.set(fact.knowledgeItemId, k);
    }
    k.add(fact.id);
  }

  get(id: FactId): Fact | undefined {
    return this.facts.get(id);
  }

  listBySubject(kind: string, id: string): readonly Fact[] {
    const set = this.bySubject.get(subjectKey(kind, id));
    if (!set) return [];
    return this.collectSorted(set);
  }

  listByPredicate(predicate: string): readonly Fact[] {
    const set = this.byPredicate.get(predicate);
    if (!set) return [];
    return this.collectSorted(set);
  }

  listByKnowledgeItem(itemId: KnowledgeItemId): readonly Fact[] {
    const set = this.byKnowledgeItem.get(itemId);
    if (!set) return [];
    return this.collectSorted(set);
  }

  private collectSorted(set: Set<FactId>): readonly Fact[] {
    const out: Fact[] = [];
    for (const id of set) {
      const f = this.facts.get(id);
      if (f) out.push(f);
    }
    out.sort((a, b) => {
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return out;
  }
}
