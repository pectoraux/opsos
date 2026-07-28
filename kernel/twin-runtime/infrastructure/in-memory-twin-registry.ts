/**
 * @kernel/twin-runtime/infrastructure/in-memory-twin-registry — the in-memory
 * `TwinRegistry` implementation.
 *
 * Pure `Map<entityId, TwinState>`. `updateState` increments the version and
 * stamps `updatedAt = now`. No `Date.now()`, no `Math.random()`.
 */

import type { TwinState, TwinRegistry } from "../domain";
import type { UnknownRecord } from "@kernel/shared-kernel";

export class InMemoryTwinRegistry implements TwinRegistry {
  private readonly byId = new Map<string, TwinState>();

  register(state: TwinState): void {
    this.byId.set(state.entityId, state);
  }

  get(entityId: string): TwinState | undefined {
    return this.byId.get(entityId);
  }

  list(): readonly TwinState[] {
    return Array.from(this.byId.values());
  }

  listByType(entityType: string): readonly TwinState[] {
    return this.list().filter((t) => t.entityType === entityType);
  }

  updateState(entityId: string, state: UnknownRecord, now: number): TwinState | undefined {
    const existing = this.byId.get(entityId);
    if (!existing) return undefined;
    const next: TwinState = {
      id: existing.id,
      entityId,
      entityType: existing.entityType,
      currentState: state,
      version: existing.version + 1,
      updatedAt: now,
      fidelity: existing.fidelity,
    };
    this.byId.set(entityId, next);
    return next;
  }
}
