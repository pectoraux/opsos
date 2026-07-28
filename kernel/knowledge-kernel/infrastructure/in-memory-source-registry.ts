/**
 * @kernel/knowledge-kernel/infrastructure/in-memory-source-registry — the
 * in-memory `SourceRegistry` implementation.
 *
 * Pure data structures:
 *   - `Map<SourceId, Source>` — canonical source records
 *   - `Map<SourceType, Set<SourceId>>` — type → source ids index
 *
 * No `Date.now()`, no `Math.random()`. `listByType` returns sources sorted by
 * id lexicographic for deterministic output.
 */

import type { SourceId } from "@kernel/shared-kernel";
import type { Source, SourceType } from "@kernel/shared-kernel";
import type { SourceRegistry } from "../domain";

export class InMemorySourceRegistry implements SourceRegistry {
  private readonly sources = new Map<SourceId, Source>();
  private readonly byType = new Map<SourceType, Set<SourceId>>();

  register(source: Source): void {
    const prev = this.sources.get(source.id);
    if (prev && prev.type !== source.type) {
      const oldSet = this.byType.get(prev.type);
      if (oldSet) oldSet.delete(prev.id);
    }
    this.sources.set(source.id, source);
    let set = this.byType.get(source.type);
    if (!set) {
      set = new Set();
      this.byType.set(source.type, set);
    }
    set.add(source.id);
  }

  get(id: SourceId): Source | undefined {
    return this.sources.get(id);
  }

  list(): readonly Source[] {
    return Array.from(this.sources.values());
  }

  listByType(type: SourceType): readonly Source[] {
    const set = this.byType.get(type);
    if (!set) return [];
    const out: Source[] = [];
    for (const id of set) {
      const s = this.sources.get(id);
      if (s) out.push(s);
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }
}
