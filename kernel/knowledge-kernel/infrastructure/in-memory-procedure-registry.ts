/**
 * @kernel/knowledge-kernel/infrastructure/in-memory-procedure-registry — the
 * in-memory `ProcedureRegistry` implementation.
 *
 * Pure data structures:
 *   - `Map<ProcedureId, Procedure>` — canonical procedure records
 *   - `Map<KnowledgeItemId, Set<ProcedureId>>` — knowledge-item → procedure ids
 *   - `Map<string, Set<ProcedureId>>` — material → procedure ids
 *
 * No `Date.now()`, no `Math.random()`. List methods return procedures sorted
 * by id lexicographic ASC.
 */

import type { ProcedureId, KnowledgeItemId } from "@kernel/shared-kernel";
import type { Procedure } from "@kernel/shared-kernel";
import type { ProcedureRegistry } from "../domain";

export class InMemoryProcedureRegistry implements ProcedureRegistry {
  private readonly procedures = new Map<ProcedureId, Procedure>();
  private readonly byKnowledgeItem = new Map<
    KnowledgeItemId,
    Set<ProcedureId>
  >();
  private readonly byMaterial = new Map<string, Set<ProcedureId>>();

  register(procedure: Procedure): void {
    const prev = this.procedures.get(procedure.id);
    if (prev) {
      if (prev.knowledgeItemId !== procedure.knowledgeItemId) {
        const oldSet = this.byKnowledgeItem.get(prev.knowledgeItemId);
        if (oldSet) oldSet.delete(prev.id);
      }
      for (const m of prev.requiredMaterials) {
        if (!procedure.requiredMaterials.includes(m)) {
          const oldSet = this.byMaterial.get(m);
          if (oldSet) oldSet.delete(prev.id);
        }
      }
    }
    this.procedures.set(procedure.id, procedure);

    let k = this.byKnowledgeItem.get(procedure.knowledgeItemId);
    if (!k) {
      k = new Set();
      this.byKnowledgeItem.set(procedure.knowledgeItemId, k);
    }
    k.add(procedure.id);

    for (const m of procedure.requiredMaterials) {
      let ms = this.byMaterial.get(m);
      if (!ms) {
        ms = new Set();
        this.byMaterial.set(m, ms);
      }
      ms.add(procedure.id);
    }
  }

  get(id: ProcedureId): Procedure | undefined {
    return this.procedures.get(id);
  }

  list(): readonly Procedure[] {
    const out = Array.from(this.procedures.values());
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  listByKnowledgeItem(itemId: KnowledgeItemId): readonly Procedure[] {
    const set = this.byKnowledgeItem.get(itemId);
    if (!set) return [];
    return this.collectSorted(set);
  }

  listByRequiredMaterial(material: string): readonly Procedure[] {
    const set = this.byMaterial.get(material);
    if (!set) return [];
    return this.collectSorted(set);
  }

  private collectSorted(set: Set<ProcedureId>): readonly Procedure[] {
    const out: Procedure[] = [];
    for (const id of set) {
      const p = this.procedures.get(id);
      if (p) out.push(p);
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }
}
