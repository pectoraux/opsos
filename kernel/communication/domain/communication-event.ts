/**
 * @kernel/communication/domain/communication-event — the CommunicationEvent
 * primitive + CommunicationEventStream PORT.
 *
 * Every state change in the communication runtime emits a CommunicationEvent:
 * messages queued / sent / delivered / failed, notifications dispatched,
 * channels disabled, bounces detected. The event stream is the substrate that
 * projections, audit logs, and integration webhooks subscribe to.
 *
 * Determinism: events are pure data. `timestamp` is epoch-millis from the
 * caller's `now`; never `Date.now()`. Event id generation is the engine's
 * responsibility and MUST be deterministic (typically `hashSeed` of the
 * payload).
 */
import type { UnknownPayload } from "@kernel/shared-kernel";

// ── Event kind ──────────────────────────────────────────────────────────────

/**
 * The set of events the communication runtime publishes.
 *
 * Message lifecycle:
 *   - `message-queued`    — a Message was created and is awaiting dispatch.
 *   - `message-sent`      — the provider accepted the Message.
 *   - `message-delivered` — the provider confirmed delivery.
 *   - `message-failed`    — the provider rejected the Message (terminal).
 *
 * Notification lifecycle:
 *   - `notification-dispatched` — the NotificationEngine finished dispatching
 *                                 a notification (success or partial failure).
 *
 * Platform lifecycle:
 *   - `channel-disabled`  — a channel transitioned to `disabled` or `error`
 *                           (e.g. credentials revoked, manual pause).
 *   - `bounce-detected`   — an inbound bounce was recorded for a recipient +
 *                           channelKind; the suppression list was updated.
 */
export type CommunicationEventKind =
  | "message-queued"
  | "message-sent"
  | "message-delivered"
  | "message-failed"
  | "notification-dispatched"
  | "channel-disabled"
  | "bounce-detected";

// ── CommunicationEvent ──────────────────────────────────────────────────────

/**
 * An immutable event record. `payload` is the kind-specific data
 * (messageId, channelId, recipientId, error, etc.).
 */
export interface CommunicationEvent {
  readonly id: string;
  readonly kind: CommunicationEventKind;
  readonly payload: UnknownPayload;
  readonly timestamp: number;
}

// ── Event handler ───────────────────────────────────────────────────────────

/**
 * A subscriber function. Receives every published event. Implementations MUST
 * not throw — exceptions break the publish loop and are silently swallowed by
 * the in-memory implementation (the event is still recorded).
 */
export type CommunicationEventHandler = (event: CommunicationEvent) => void;

// ── CommunicationEventStream PORT ───────────────────────────────────────────

/**
 * The CommunicationEventStream PORT. A pub/sub bus with bounded recent-event
 * retention for late subscribers / replay.
 *
 * - `publish(event)`   — append to the stream and fan out to all subscribers.
 * - `subscribe(handler)`— register a subscriber; returns an unsubscribe fn.
 * - `recent(count)`    — the last N events, oldest-first (i.e. the tail of the
 *                        stream in chronological order).
 */
export interface CommunicationEventStream {
  publish(event: CommunicationEvent): void;
  subscribe(handler: CommunicationEventHandler): () => void;
  recent(count: number): readonly CommunicationEvent[];
}

// Re-export for callers.
export type { UnknownPayload };
