/**
 * @kernel/communication/domain/channel — the Channel primitive + ChannelRegistry
 * PORT.
 *
 * A Channel is an outbound communication endpoint owned by the platform:
 * email, SMS, push, WhatsApp, voice, webhook, internal event bus, in-app
 * notification feed. Channels are configured once (provider credentials,
 * webhook URLs, sender IDs) and then referenced by id from Notifications.
 *
 * The platform decides HOW a notification is delivered; the Channel is the
 * "where". Channels can be active / disabled / error — a disabled channel is
 * skipped at dispatch time, an error channel emits a `channel-disabled` event.
 *
 * Determinism: pure data, no time, no randomness. All mutability lives behind
 * the ChannelRegistry PORT, realised in infrastructure/.
 */
import type { UnknownRecord } from "@kernel/shared-kernel";

// ── Channel kind ────────────────────────────────────────────────────────────

/**
 * The set of channel kinds the OpsOS communication runtime supports.
 *
 * `internal` is the platform's own event bus (in-process, no external
 * provider). `in-app` is the user-facing notification feed (rendered in the
 * OpsOS UI). The other kinds map to external providers.
 */
export type ChannelKind =
  | "email"
  | "sms"
  | "push"
  | "whatsapp"
  | "voice"
  | "webhook"
  | "internal"
  | "in-app";

// ── Channel status ──────────────────────────────────────────────────────────

/**
 * Lifecycle status of a channel.
 *
 * - `active`   — eligible for dispatch.
 * - `disabled` — explicitly paused; skipped at dispatch (counts as suppressed
 *                for delivery-planning purposes but does NOT emit a bounce).
 * - `error`    — provider reported a permanent failure (e.g. revoked
 *                credentials); the channel is quarantined until an operator
 *                re-activates it.
 */
export type ChannelStatus = "active" | "disabled" | "error";

// ── Channel config ──────────────────────────────────────────────────────────

/**
 * Provider-specific configuration for a channel. The kernel treats this as an
 * opaque bag — concrete providers (SMTP, Twilio, FCM, …) interpret the fields
 * in infrastructure adapters. The kernel only persists and routes it.
 *
 * Examples:
 *   - email:    { host, port, from, credentialsRef }
 *   - sms:      { provider, fromNumber, credentialsRef }
 *   - webhook:  { url, secret, method }
 *   - internal: { topic }
 */
export type ChannelConfig = Readonly<Record<string, unknown>>;

// ── Channel ─────────────────────────────────────────────────────────────────

/**
 * An outbound communication channel. Immutable value object; status changes
 * produce a new Channel via the registry's `updateStatus`.
 */
export interface Channel {
  readonly id: string;
  readonly kind: ChannelKind;
  readonly name: string;
  readonly config: ChannelConfig;
  readonly status: ChannelStatus;
}

// ── ChannelRegistry PORT ────────────────────────────────────────────────────

/**
 * The ChannelRegistry PORT. Stores channels by id and by kind, supports status
 * transitions, and is the canonical source of "what channels exist".
 *
 * Implementations MUST be deterministic (no Date.now/Math.random). Register is
 * idempotent — registering the same id twice replaces the prior record.
 */
export interface ChannelRegistry {
  /** Register or replace a channel. Idempotent by id. */
  register(channel: Channel): void;
  /** Look up a channel by id. */
  get(id: string): Channel | undefined;
  /** All registered channels, in insertion order. */
  list(): readonly Channel[];
  /** All channels of a given kind, in insertion order. */
  listByKind(kind: ChannelKind): readonly Channel[];
  /**
   * Transition a channel's status. Idempotent: setting the current status is a
   * no-op. Returns void; callers can re-read via `get` to confirm.
   */
  updateStatus(id: string, status: ChannelStatus): void;
}

// Re-export for callers that import the UnknownRecord type alongside.
export type { UnknownRecord };
