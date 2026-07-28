/**
 * @kernel/communication/domain/message — the Message primitive.
 *
 * A Message is a single outbound unit bound to ONE channel and addressed to one
 * or more Recipients. A Notification fans out into N Messages (one per
 * channel).
 *
 * Lifecycle: queued → sent → delivered  (happy path)
 *                   ↘ failed            (provider rejected)
 *                   ↘ bounced           (provider accepted, then permanent
 *                                         failure — bad address, spam, etc.)
 *
 * Determinism: pure data. All time fields are epoch-millis sourced from the
 * caller-supplied `now` argument; never `Date.now()`.
 */
import type { UnknownRecord } from "@kernel/shared-kernel";
import type { Recipient } from "./recipient";

// ── Status ──────────────────────────────────────────────────────────────────

/**
 * The delivery status of a single Message, from the platform's perspective.
 *
 * - `queued`    — created, awaiting dispatch.
 * - `sent`      — handed to the provider; not yet confirmed.
 * - `delivered` — provider confirmed delivery (e.g. SMTP 250, FCM ACK).
 * - `failed`    — provider rejected before send (validation, auth, rate).
 * - `bounced`   — provider accepted then bounced (post-send permanent failure).
 */
export type MessageStatus = "queued" | "sent" | "delivered" | "failed" | "bounced";

// ── Priority ────────────────────────────────────────────────────────────────

/**
 * Delivery priority. Higher priority messages skip the rate-limiter queue and
 * may bypass quiet-hours (per policy). Maps 1:1 to NotificationPriority.
 */
export type MessagePriority = "low" | "normal" | "high" | "urgent";

// ── Message ─────────────────────────────────────────────────────────────────

/**
 * A single outbound message. The `templateRef` + `variables` fields capture
 * the template that produced the rendered `subject`/`body` — this is kept for
 * auditability (so a sent message can be re-rendered later if the template
 * changes).
 *
 * `metadata` is a free-form bag for provider refs, retry counts, diagnostic
 * tags — anything the dispatch adapter wants to attach.
 */
export interface Message {
  readonly id: string;
  readonly channelId: string;
  readonly to: readonly Recipient[];
  readonly from: string;
  readonly subject?: string;
  readonly body: string;
  /** Template id that produced this message, if any. */
  readonly templateRef?: string;
  /** Variables used to render the template. */
  readonly variables?: Readonly<Record<string, string>>;
  readonly priority: MessagePriority;
  readonly status: MessageStatus;
  readonly createdAt: number;
  readonly sentAt?: number;
  readonly deliveredAt?: number;
  readonly metadata?: UnknownRecord;
}

// Re-export so callers importing Message also see the Recipient type.
export type { Recipient, UnknownRecord };
