/**
 * @kernel/knowledge-kernel/infrastructure/in-memory-evidence-registry — the
 * in-memory `EvidenceRegistry` implementation.
 *
 * Pure data structures:
 *   - `Map<EvidenceId, Evidence>` — canonical evidence records
 *   - `Map<SourceId, Set<EvidenceId>>` — source → evidence ids index
 *
 * No `Date.now()`, no `Math.random()`. `listBySource` returns evidence
 * sorted by id lexicographic for deterministic output.
 */

import type { EvidenceId, SourceId } from "@kernel/shared-kernel";
import type { Evidence } from "@kernel/shared-kernel";
import type { EvidenceRegistry } from "../domain";

export class InMemoryEvidenceRegistry implements EvidenceRegistry {
  private readonly evidence = new Map<EvidenceId, Evidence>();
  private readonly bySource = new Map<SourceId, Set<EvidenceId>>();

  register(evidence: Evidence): void {
    const prev = this.evidence.get(evidence.id);
    if (prev && prev.sourceId !== evidence.sourceId) {
      const oldSet = this.bySource.get(prev.sourceId);
      if (oldSet) oldSet.delete(prev.id);
    }
    this.evidence.set(evidence.id, evidence);
    let set = this.bySource.get(evidence.sourceId);
    if (!set) {
      set = new Set();
      this.bySource.set(evidence.sourceId, set);
    }
    set.add(evidence.id);
  }

  get(id: EvidenceId): Evidence | undefined {
    return this.evidence.get(id);
  }

  listBySource(sourceId: SourceId): readonly Evidence[] {
    const set = this.bySource.get(sourceId);
    if (!set) return [];
    const out: Evidence[] = [];
    for (const id of set) {
      const e = this.evidence.get(id);
      if (e) out.push(e);
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }
}
