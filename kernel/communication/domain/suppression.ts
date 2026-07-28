/**
 * @kernel/communication/domain/suppression — the SuppressionList primitive +
 * SuppressionChecker PORT.
 *
 * The suppression list is the platform's canonical "do not contact" record.
 * Before dispatching to a (recipient, channelKind) pair, the engine checks
 * suppression. Suppression entries have a reason and optional expiry.
 *
 * Reasons:
 *   - `opt-out`   — the recipient explicitly unsubscribed (manual toggle).
 *   - `bounce`    — a delivery bounced; the platform auto-suppressed.
 *   - `complaint` — the recipient marked a message as spam.
 *   - `manual`    — an operator suppressed the recipient (e.g. security hold).
 *
 * Expiry: an entry with `expiresAt` is treated as NOT suppressed once
 * `now >= expiresAt`. Permanent suppressions have `expiresAt: undefined`.
 *
 * Determinism: pure data. `suppressedAt` and `expiresAt` are epoch-millis
 * from the caller's `now`; never `Date.now()`.
 */
import type { ChannelKind } from "./channel";

// ── Suppression reason ──────────────────────────────────────────────────────

export type SuppressionReason = "opt-out" | "bounce" | "complaint" | "manual";

// ── SuppressionEntry ────────────────────────────────────────────────────────

/**
 * A single suppression record. Uniquely identified by (recipientId,
 * channelKind) — the registry enforces this (a new entry for the same pair
 * replaces the prior one).
 */
export interface SuppressionEntry {
  readonly recipientId: string;
  readonly channelKind: ChannelKind;
  readonly reason: SuppressionReason;
  readonly suppressedAt: number;
  readonly expiresAt?: number;
}

// ── SuppressionList ─────────────────────────────────────────────────────────

/**
 * The full suppression list value object. Carries all entries; the
 * SuppressionChecker PORT provides the query/mutation operations.
 */
export interface SuppressionList {
  readonly entries: readonly SuppressionEntry[];
}

// ── SuppressionChecker PORT ─────────────────────────────────────────────────

/**
 * The SuppressionChecker PORT.
 *
 * - `isSuppressed(recipientId, channelKind, now)` — true if there is a
 *   non-expired entry for the pair.
 * - `suppress(recipientId, channelKind, reason, now, expiresAt?)` — add or
 *   replace an entry.
 * - `unsuppress(recipientId, channelKind)` — remove an entry. Idempotent.
 *
 * `list()` and `listByRecipient()` are included for admin/audit use.
 */
export interface SuppressionChecker {
  isSuppressed(recipientId: string, channelKind: ChannelKind, now: number): boolean;
  suppress(
    recipientId: string,
    channelKind: ChannelKind,
    reason: SuppressionReason,
    now: number,
    expiresAt?: number
  ): void;
  unsuppress(recipientId: string, channelKind: ChannelKind): void;
  /** All entries, in insertion order. */
  list(): readonly SuppressionEntry[];
  /** All entries for a given recipient, in insertion order. */
  listByRecipient(recipientId: string): readonly SuppressionEntry[];
}
