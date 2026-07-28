/**
 * @kernel/knowledge-kernel/infrastructure/in-memory-standard-registry — the
 * in-memory `StandardRegistry` implementation.
 *
 * Pure data structures:
 *   - `Map<StandardId, Standard>` — canonical standard records
 *   - `Map<StandardCategory, Set<StandardId>>` — category → standard ids
 *   - `Map<string, Set<StandardId>>` — code → standard ids
 *
 * No `Date.now()`, no `Math.random()`. List methods return standards sorted
 * by id lexicographic ASC.
 */

import type { StandardId } from "@kernel/shared-kernel";
import type {
  Standard,
  StandardCategory,
} from "@kernel/shared-kernel";
import type { StandardRegistry } from "../domain";

export class InMemoryStandardRegistry implements StandardRegistry {
  private readonly standards = new Map<StandardId, Standard>();
  private readonly byCategory = new Map<StandardCategory, Set<StandardId>>();
  private readonly byCode = new Map<string, Set<StandardId>>();

  register(standard: Standard): void {
    const prev = this.standards.get(standard.id);
    if (prev) {
      if (prev.category !== standard.category) {
        const oldSet = this.byCategory.get(prev.category);
        if (oldSet) oldSet.delete(prev.id);
      }
      if (prev.code !== standard.code) {
        const oldSet = this.byCode.get(prev.code);
        if (oldSet) oldSet.delete(prev.id);
      }
    }
    this.standards.set(standard.id, standard);

    let c = this.byCategory.get(standard.category);
    if (!c) {
      c = new Set();
      this.byCategory.set(standard.category, c);
    }
    c.add(standard.id);

    let cod = this.byCode.get(standard.code);
    if (!cod) {
      cod = new Set();
      this.byCode.set(standard.code, cod);
    }
    cod.add(standard.id);
  }

  get(id: StandardId): Standard | undefined {
    return this.standards.get(id);
  }

  list(): readonly Standard[] {
    const out = Array.from(this.standards.values());
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  listByCategory(category: StandardCategory): readonly Standard[] {
    const set = this.byCategory.get(category);
    if (!set) return [];
    return this.collectSorted(set);
  }

  listByCode(code: string): readonly Standard[] {
    const set = this.byCode.get(code);
    if (!set) return [];
    return this.collectSorted(set);
  }

  private collectSorted(set: Set<StandardId>): readonly Standard[] {
    const out: Standard[] = [];
    for (const id of set) {
      const s = this.standards.get(id);
      if (s) out.push(s);
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }
}
