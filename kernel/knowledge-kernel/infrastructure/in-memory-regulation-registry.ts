/**
 * @kernel/knowledge-kernel/infrastructure/in-memory-regulation-registry — the
 * in-memory `RegulationRegistry` implementation.
 *
 * Pure data structures:
 *   - `Map<RegulationId, Regulation>` — canonical regulation records
 *   - `Map<string, Set<RegulationId>>` — jurisdiction → regulation ids
 *   - `Map<RegulationSeverity, Set<RegulationId>>` — severity → regulation ids
 *   - `Map<KnowledgeItemId, Set<RegulationId>>` — knowledge-item → regulation ids
 *
 * No `Date.now()`, no `Math.random()`. List methods return regulations sorted
 * by id lexicographic ASC.
 */

import type { RegulationId, KnowledgeItemId } from "@kernel/shared-kernel";
import type {
  Regulation,
  RegulationSeverity,
} from "@kernel/shared-kernel";
import type { RegulationRegistry } from "../domain";

export class InMemoryRegulationRegistry implements RegulationRegistry {
  private readonly regulations = new Map<RegulationId, Regulation>();
  private readonly byJurisdiction = new Map<string, Set<RegulationId>>();
  private readonly bySeverity = new Map<RegulationSeverity, Set<RegulationId>>();
  private readonly byKnowledgeItem = new Map<
    KnowledgeItemId,
    Set<RegulationId>
  >();

  register(regulation: Regulation): void {
    const prev = this.regulations.get(regulation.id);
    if (prev) {
      if (prev.jurisdiction !== regulation.jurisdiction) {
        const oldSet = this.byJurisdiction.get(prev.jurisdiction);
        if (oldSet) oldSet.delete(prev.id);
      }
      if (prev.severity !== regulation.severity) {
        const oldSet = this.bySeverity.get(prev.severity);
        if (oldSet) oldSet.delete(prev.id);
      }
      if (prev.knowledgeItemId !== regulation.knowledgeItemId) {
        const oldSet = this.byKnowledgeItem.get(prev.knowledgeItemId);
        if (oldSet) oldSet.delete(prev.id);
      }
    }
    this.regulations.set(regulation.id, regulation);

    let j = this.byJurisdiction.get(regulation.jurisdiction);
    if (!j) {
      j = new Set();
      this.byJurisdiction.set(regulation.jurisdiction, j);
    }
    j.add(regulation.id);

    let s = this.bySeverity.get(regulation.severity);
    if (!s) {
      s = new Set();
      this.bySeverity.set(regulation.severity, s);
    }
    s.add(regulation.id);

    let k = this.byKnowledgeItem.get(regulation.knowledgeItemId);
    if (!k) {
      k = new Set();
      this.byKnowledgeItem.set(regulation.knowledgeItemId, k);
    }
    k.add(regulation.id);
  }

  get(id: RegulationId): Regulation | undefined {
    return this.regulations.get(id);
  }

  list(): readonly Regulation[] {
    const out = Array.from(this.regulations.values());
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  listByJurisdiction(jurisdiction: string): readonly Regulation[] {
    const set = this.byJurisdiction.get(jurisdiction);
    if (!set) return [];
    return this.collectSorted(set);
  }

  listBySeverity(severity: RegulationSeverity): readonly Regulation[] {
    const set = this.bySeverity.get(severity);
    if (!set) return [];
    return this.collectSorted(set);
  }

  listByKnowledgeItem(itemId: string): readonly Regulation[] {
    const set = this.byKnowledgeItem.get(itemId as KnowledgeItemId);
    if (!set) return [];
    return this.collectSorted(set);
  }

  private collectSorted(set: Set<RegulationId>): readonly Regulation[] {
    const out: Regulation[] = [];
    for (const id of set) {
      const r = this.regulations.get(id);
      if (r) out.push(r);
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }
}
