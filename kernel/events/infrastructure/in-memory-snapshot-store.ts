/**
 * @kernel/events/infrastructure/in-memory-snapshot-store — reference in-memory
 * SnapshotStore.
 */

import type { AggregateId } from "@kernel/shared-kernel";
import type { SnapshotStore, Snapshot } from "../domain/snapshot-store";

export class InMemorySnapshotStore implements SnapshotStore {
  private readonly snapshots: Map<string, Snapshot> = new Map();

  async load<TState = unknown>(
    aggregateId: AggregateId | string
  ): Promise<Snapshot<TState> | null> {
    const s = this.snapshots.get(String(aggregateId));
    return s ? (s as Snapshot<TState>) : null;
  }

  async save<TState = unknown>(snapshot: Snapshot<TState>): Promise<void> {
    this.snapshots.set(String(snapshot.aggregateId), snapshot as Snapshot);
  }

  clear(): void {
    this.snapshots.clear();
  }
}
