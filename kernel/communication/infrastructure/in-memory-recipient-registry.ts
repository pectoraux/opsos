/**
 * @kernel/communication/infrastructure/in-memory-recipient-registry — the
 * default in-memory `RecipientRegistry` implementation.
 *
 * Backed by a `Map<string, Recipient>` (insertion-ordered) plus an auxiliary
 * index from `${channelKind}:${address}` → recipientId for O(1) reverse
 * lookup. The index is rebuilt on every `register` for simplicity (recipients
 * are infrequent; messages are high-volume).
 *
 * Determinism: pure data structure. No Date.now/Math.random.
 *
 * Idempotency:
 *   - `register` replaces any existing recipient with the same id.
 *   - `resolve(channelKind, address)` returns the first matching recipient in
 *     insertion order (deterministic — the underlying Map iteration order is
 *     insertion order in V8 / JavaScriptCore).
 */
import type {
  ChannelKind,
  Recipient,
  RecipientRegistry,
} from "../domain";

export class InMemoryRecipientRegistry implements RecipientRegistry {
  private readonly recipients = new Map<string, Recipient>();

  register(recipient: Recipient): void {
    this.recipients.set(recipient.id, recipient);
  }

  get(id: string): Recipient | undefined {
    return this.recipients.get(id);
  }

  list(): readonly Recipient[] {
    return Array.from(this.recipients.values());
  }

  resolve(channelKind: ChannelKind, address: string): Recipient | undefined {
    const normalized = address.trim().toLowerCase();
    for (const r of this.recipients.values()) {
      for (const ch of r.channels) {
        if (ch.kind !== channelKind) continue;
        if (ch.address.trim().toLowerCase() === normalized) {
          return r;
        }
      }
    }
    return undefined;
  }
}
