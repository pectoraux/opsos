/**
 * @kernel/twin-runtime/infrastructure/in-memory-history-store — the in-memory
 * `HistoryStore` implementation.
 *
 * Pure `Map<entityId, TwinSnapshot[]>`. Snapshots are appended in order;
 * `getHistory` returns the slice in `[from, to]` (inclusive) ascending by
 * timestamp. No `Date.now()`, no `Math.random()`.
 */

import type { TwinSnapshot, HistoryStore } from "../domain";

export class InMemoryHistoryStore implements HistoryStore {
  private readonly byEntity = new Map<string, TwinSnapshot[]>();

  record(entityId: string, snapshot: TwinSnapshot): void {
    const list = this.byEntity.get(entityId) ?? [];
    list.push(snapshot);
    this.byEntity.set(entityId, list);
  }

  getHistory(entityId: string, from: number, to: number): readonly TwinSnapshot[] {
    const list = this.byEntity.get(entityId);
    if (!list) return [];
    return list
      .filter((s) => s.timestamp >= from && s.timestamp <= to)
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  getLatest(entityId: string): TwinSnapshot | undefined {
    const list = this.byEntity.get(entityId);
    if (!list || list.length === 0) return undefined;
    let latest = list[0];
    for (const s of list) {
      if (s.timestamp > latest.timestamp) latest = s;
    }
    return latest;
  }
}
