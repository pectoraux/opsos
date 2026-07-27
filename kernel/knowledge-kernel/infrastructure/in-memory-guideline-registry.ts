/**
 * @kernel/knowledge-kernel/infrastructure/in-memory-guideline-registry — the
 * in-memory `GuidelineRegistry` implementation.
 *
 * Pure data structures:
 *   - `Map<GuidelineId, Guideline>` — canonical guideline records
 *   - `Map<KnowledgeItemId, Set<GuidelineId>>` — knowledge-item → guideline ids
 *
 * No `Date.now()`, no `Math.random()`. `listByKnowledgeItem` returns
 * guidelines sorted by priority DESC, then id lexicographic ASC.
 */

import type { GuidelineId, KnowledgeItemId } from "@kernel/shared-kernel";
import type { Guideline } from "@kernel/shared-kernel";
import type { GuidelineRegistry } from "../domain";

export class InMemoryGuidelineRegistry implements GuidelineRegistry {
  private readonly guidelines = new Map<GuidelineId, Guideline>();
  private readonly byKnowledgeItem = new Map<
    KnowledgeItemId,
    Set<GuidelineId>
  >();

  register(guideline: Guideline): void {
    const prev = this.guidelines.get(guideline.id);
    if (prev) {
      if (prev.knowledgeItemId !== guideline.knowledgeItemId) {
        const oldSet = this.byKnowledgeItem.get(prev.knowledgeItemId);
        if (oldSet) oldSet.delete(prev.id);
      }
    }
    this.guidelines.set(guideline.id, guideline);

    let k = this.byKnowledgeItem.get(guideline.knowledgeItemId);
    if (!k) {
      k = new Set();
      this.byKnowledgeItem.set(guideline.knowledgeItemId, k);
    }
    k.add(guideline.id);
  }

  get(id: GuidelineId): Guideline | undefined {
    return this.guidelines.get(id);
  }

  list(): readonly Guideline[] {
    const out = Array.from(this.guidelines.values());
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  listByKnowledgeItem(itemId: KnowledgeItemId): readonly Guideline[] {
    const set = this.byKnowledgeItem.get(itemId);
    if (!set) return [];
    const out: Guideline[] = [];
    for (const id of set) {
      const g = this.guidelines.get(id);
      if (g) out.push(g);
    }
    out.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return out;
  }
}
