/**
 * @kernel/communication/infrastructure/in-memory-channel-registry — the default
 * in-memory `ChannelRegistry` implementation.
 *
 * Backed by a `Map<string, Channel>` plus an insertion-order index (the map's
 * iteration order, which is insertion order in V8 / JavaScriptCore). All
 * operations are O(1) for register/get, O(n) for list/listByKind/updateStatus.
 *
 * Determinism: no Date.now/Math.random. The registry is a pure data structure;
 * mutability is contained and follows the port contract exactly.
 *
 * Idempotency:
 *   - `register` replaces any existing channel with the same id (preserving
 *     insertion order — the original slot is updated in place).
 *   - `updateStatus` on an unknown id is a silent no-op (returns void; callers
 *     can `get` to confirm). On a known id, the channel is replaced with a
 *     new immutable record carrying the new status.
 */
import type {
  Channel,
  ChannelKind,
  ChannelRegistry,
  ChannelStatus,
} from "../domain";

export class InMemoryChannelRegistry implements ChannelRegistry {
  private readonly channels = new Map<string, Channel>();

  register(channel: Channel): void {
    this.channels.set(channel.id, channel);
  }

  get(id: string): Channel | undefined {
    return this.channels.get(id);
  }

  list(): readonly Channel[] {
    return Array.from(this.channels.values());
  }

  listByKind(kind: ChannelKind): readonly Channel[] {
    const out: Channel[] = [];
    for (const c of this.channels.values()) {
      if (c.kind === kind) out.push(c);
    }
    return out;
  }

  updateStatus(id: string, status: ChannelStatus): void {
    const existing = this.channels.get(id);
    if (existing === undefined) return;
    if (existing.status === status) return;
    this.channels.set(id, { ...existing, status });
  }
}
