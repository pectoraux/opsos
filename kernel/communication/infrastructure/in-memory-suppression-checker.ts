/**
 * @kernel/communication/infrastructure/in-memory-suppression-checker — the
 * default in-memory `SuppressionChecker` implementation.
 *
 * Backed by a `Map<string, SuppressionEntry>` keyed by `${recipientId}|${channelKind}`.
 * The (recipientId, channelKind) pair is the unique identity of a suppression
 * entry — re-suppressing the same pair replaces the prior entry (the latest
 * reason / expiry wins).
 *
 * Expiry semantics:
 *   - `isSuppressed(..., now)` returns `false` if the entry has `expiresAt`
 *     and `now >= expiresAt`. The entry is NOT auto-deleted (audit trail
 *     preserved); it simply stops being effective.
 *   - Permanent suppressions (`expiresAt: undefined`) are always effective.
 *
 * Determinism: pure data structure. No Date.now/Math.random. The `now` for
 * expiry comparison flows in via the `isSuppressed` argument.
 */
import type {
  ChannelKind,
  SuppressionChecker,
  SuppressionEntry,
  SuppressionReason,
} from "../domain";

function key(recipientId: string, channelKind: ChannelKind): string {
  return `${recipientId}|${channelKind}`;
}

export class InMemorySuppressionChecker implements SuppressionChecker {
  private readonly entries = new Map<string, SuppressionEntry>();

  isSuppressed(recipientId: string, channelKind: ChannelKind, now: number): boolean {
    const entry = this.entries.get(key(recipientId, channelKind));
    if (entry === undefined) return false;
    if (entry.expiresAt !== undefined && now >= entry.expiresAt) return false;
    return true;
  }

  suppress(
    recipientId: string,
    channelKind: ChannelKind,
    reason: SuppressionReason,
    now: number,
    expiresAt?: number
  ): void {
    const entry: SuppressionEntry = {
      recipientId,
      channelKind,
      reason,
      suppressedAt: now,
      expiresAt,
    };
    this.entries.set(key(recipientId, channelKind), entry);
  }

  unsuppress(recipientId: string, channelKind: ChannelKind): void {
    this.entries.delete(key(recipientId, channelKind));
  }

  list(): readonly SuppressionEntry[] {
    return Array.from(this.entries.values());
  }

  listByRecipient(recipientId: string): readonly SuppressionEntry[] {
    const out: SuppressionEntry[] = [];
    for (const e of this.entries.values()) {
      if (e.recipientId === recipientId) out.push(e);
    }
    return out;
  }
}
