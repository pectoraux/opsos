/**
 * @kernel/communication/domain/recipient — the Recipient primitive +
 * RecipientRegistry PORT.
 *
 * A Recipient is the entity a notification is addressed to (typically a user,
 * but could be a team, an on-call rotation, or a service account). Each
 * recipient has one or more RecipientChannels — a (channelKind, address,
 * verified) tuple — that the engine uses to resolve where to actually deliver.
 *
 * Example:
 *   {
 *     id: "user-42",
 *     name: "Ada Lovelace",
 *     channels: [
 *       { kind: "email",   address: "ada@example.com",  verified: true  },
 *       { kind: "sms",     address: "+15551234567",     verified: true  },
 *       { kind: "whatsapp",address: "+15551234567",     verified: false },
 *     ],
 *   }
 *
 * The engine resolves "send to user-42 via email" by:
 *   1. Looking up recipient user-42.
 *   2. Finding their RecipientChannel where kind === "email".
 *   3. Using that channel's `address` as the delivery target.
 *
 * Determinism: pure data, no time, no randomness.
 */
import type { ChannelKind } from "./channel";

// ── RecipientChannel ────────────────────────────────────────────────────────

/**
 * A single (channelKind, address) pair for a recipient, plus a verification
 * flag. Unverified channels are skipped at dispatch (the engine reports them
 * as suppressed-with-reason=`unverified` in the NotificationResult errors
 * list, NOT as a bounce).
 */
export interface RecipientChannel {
  readonly kind: ChannelKind;
  readonly address: string;
  readonly verified: boolean;
}

// ── Recipient ───────────────────────────────────────────────────────────────

/**
 * The full recipient record. Carries the immutable id+name used by the Message
 * contract AND the channel addresses the engine dispatches to.
 *
 * The shape is a structural superset of the minimal Recipient contract used
 * inside `Message.to[]` (`{ id, name }`) — so the same interface satisfies
 * both. `Message.to[]` simply carries the recipient reference; the dispatch
 * loop reads `channels` when resolving per-channel delivery addresses.
 */
export interface Recipient {
  readonly id: string;
  readonly name: string;
  readonly channels: readonly RecipientChannel[];
}

// ── RecipientRegistry PORT ──────────────────────────────────────────────────

/**
 * The RecipientRegistry PORT. Stores recipients by id and supports reverse
 * lookup by (channelKind, address) — useful for inbound webhooks (e.g. an
 * inbound email bounce where the only signal is the recipient address).
 */
export interface RecipientRegistry {
  /** Register or replace a recipient. Idempotent by id. */
  register(recipient: Recipient): void;
  /** Look up a recipient by id. */
  get(id: string): Recipient | undefined;
  /** All registered recipients, in insertion order. */
  list(): readonly Recipient[];
  /**
   * Reverse lookup: find the recipient (if any) whose channels include the
   * given (kind, address) pair. Returns the first match in insertion order.
   */
  resolve(channelKind: ChannelKind, address: string): Recipient | undefined;
}
