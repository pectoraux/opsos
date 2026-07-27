/**
 * @kernel/projections/infrastructure/in-memory-projection-store — reference
 * Map-based ProjectionStore.
 *
 * Keys read models by `${projectionId}::${key}` in an instance-scoped `Map`.
 * Suitable for kernel self-test, the read-only inspector, and tests. NOT for
 * production persistence (no durability, no concurrency control beyond JS's
 * single-threaded execution).
 *
 * Contract notes:
 *   - `put` REPLACES (not merges) the entry at a key. The stored `ReadModel`
 *     is the exact reference passed in (immutability is the caller's contract).
 *   - `query` returns a fresh array (defensive copy of the list, not the
 *     models) so callers cannot mutate the store's internal collection.
 *   - `clear` iterates a snapshot of keys to avoid mutation-during-iteration.
 */

import type { ProjectionId } from "@kernel/shared-kernel";
import type {
  ProjectionStore,
  ProjectionQuery,
  ReadModel,
} from "../domain/projection-store";

/** Composite key for the internal map. */
function compositeKey(projectionId: ProjectionId, key: string): string {
  return `${String(projectionId)}::${key}`;
}

export class InMemoryProjectionStore implements ProjectionStore {
  private readonly models: Map<string, ReadModel> = new Map();

  async get<TState = unknown>(
    projectionId: ProjectionId,
    key: string
  ): Promise<ReadModel<TState> | null> {
    const found = this.models.get(compositeKey(projectionId, key));
    return found ? (found as ReadModel<TState>) : null;
  }

  async put<TState = unknown>(model: ReadModel<TState>): Promise<void> {
    // Store the reference as-is. `ReadModel` is immutable by contract; the
    // caller MUST NOT mutate the object after handing it to the store.
    this.models.set(
      compositeKey(model.projectionId, model.key),
      model as ReadModel
    );
  }

  async query<TState = unknown>(
    q: ProjectionQuery
  ): Promise<readonly ReadModel<TState>[]> {
    const pid = String(q.projectionId);
    const results: ReadModel[] = [];
    for (const model of this.models.values()) {
      if (String(model.projectionId) !== pid) continue;
      if (q.key !== undefined && model.key !== q.key) continue;
      results.push(model);
    }
    if (q.limit !== undefined && q.limit >= 0 && results.length > q.limit) {
      return results.slice(0, q.limit) as readonly ReadModel<TState>[];
    }
    return results as readonly ReadModel<TState>[];
  }

  async delete(projectionId: ProjectionId, key: string): Promise<void> {
    this.models.delete(compositeKey(projectionId, key));
  }

  async clear(projectionId: ProjectionId): Promise<void> {
    const pid = String(projectionId);
    // Snapshot keys to avoid mutating the map during iteration.
    for (const ck of Array.from(this.models.keys())) {
      const model = this.models.get(ck);
      if (model && String(model.projectionId) === pid) {
        this.models.delete(ck);
      }
    }
  }
}
