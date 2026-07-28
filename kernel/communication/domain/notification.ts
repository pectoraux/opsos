/**
 * @kernel/communication/domain/notification — the Notification primitive +
 * NotificationEngine PORT + NotificationResult.
 *
 * A Notification is the platform-level "intent to notify a recipient about
 * something". The NotificationEngine decides HOW to deliver it (which channels,
 * in what order, subject to suppression, templates, scheduling).
 *
 * Key shape:
 *   - `recipientId` — the Recipient to notify.
 *   - `channels`    — the ordered list of channel IDs to attempt (the engine
 *                     dispatches to ALL of them unless suppressed; it does NOT
 *                     fall back unless `priority: urgent` AND a channel fails
 *                     — see ADR below).
 *   - `kind`        — categorises the notification (drives routing rules,
 *                     suppression policy, audit logging).
 *   - `scheduledFor`— if set, the notification is queued until that epoch-millis
 *                     (the engine's `schedule()` sets this; `send()` clears it).
 *
 * ADR (communication-0001): the engine dispatches to ALL listed channels in
 * parallel; it does NOT do sequential fallback. The platform's suppression list
 * is the only thing that can drop a channel at dispatch time. Sequential
 * fallback (e.g. "email, then SMS if undelivered in 5 min") is a HIGHER-level
 * escalation use-case built on top of multiple Notifications + the scheduler.
 *
 * Determinism: pure data. All time fields are epoch-millis from the caller's
 * `now` argument; never `Date.now()`.
 */
import type { UnknownRecord } from "@kernel/shared-kernel";
import type { MessagePriority } from "./message";
import type { DeliveryResult } from "./delivery-result";

// ── Notification kind ───────────────────────────────────────────────────────

/**
 * The semantic kind of a notification. Drives routing, suppression policy, and
 * audit classification.
 *
 * - `alert`         — system-generated alarm (e.g. threshold breached).
 * - `reminder`      — scheduled nudge (e.g. task due soon).
 * - `confirmation`  — user-action confirmation (e.g. order placed).
 * - `update`        — state-change update (e.g. assignment transferred).
 * - `escalation`    — escalation-chain notification (e.g. on-call paged).
 * - `marketing`     — promotional (subject to strict opt-in rules).
 * - `transactional` — service-critical, always-deliver (e.g. password reset).
 */
export type NotificationKind =
  | "alert"
  | "reminder"
  | "confirmation"
  | "update"
  | "escalation"
  | "marketing"
  | "transactional";

// ── Notification status ─────────────────────────────────────────────────────

/**
 * The high-level status of a Notification (distinct from the per-message
 * MessageStatus carried by DeliveryResult).
 *
 * - `pending`    — created; not yet dispatched (may be scheduled for the future).
 * - `dispatched` — engine has sent at least one Message; terminal on success.
 * - `failed`     — engine could not deliver to ANY channel.
 * - `suppressed` — every channel was suppressed (recipient opted out / bounced).
 */
export type NotificationStatus = "pending" | "dispatched" | "failed" | "suppressed";

// ── Notification ────────────────────────────────────────────────────────────

/**
 * The notification value object. Carries enough data to render (subject/body
 * are either pre-rendered text OR a `templateRef` + `variables` pair that the
 * engine resolves via the TemplateRegistry).
 *
 * `channels` is the ordered list of channel IDs (NOT kinds) to attempt. The
 * engine looks up each channel by id to find its kind, then resolves the
 * recipient's address for that kind.
 */
export interface Notification {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly recipientId: string;
  /** Ordered list of channel IDs to dispatch to. */
  readonly channels: readonly string[];
  readonly subject?: string;
  readonly body: string;
  /** Optional template to render (overrides subject/body if present). */
  readonly templateRef?: string;
  readonly variables?: Readonly<Record<string, string>>;
  readonly priority: MessagePriority;
  readonly status: NotificationStatus;
  readonly createdAt: number;
  /** If set, the notification is scheduled for this epoch-millis. */
  readonly scheduledFor?: number;
  /** If set, the notification was dispatched at this epoch-millis. */
  readonly sentAt?: number;
  readonly metadata?: UnknownRecord;
}

// ── NotificationResult ──────────────────────────────────────────────────────

/**
 * The outcome of `NotificationEngine.send()`.
 *
 * - `dispatched`         — true if at least one Message was sent successfully.
 * - `deliveryResults`    — one per dispatched Message.
 * - `suppressedChannels` — channel IDs that were skipped due to suppression
 *                          (recipient opt-out, bounce, complaint, or manual).
 * - `errors`             — human-readable errors (suppression reasons, missing
 *                          recipient addresses, unverified channels, etc.).
 */
export interface NotificationResult {
  readonly notificationId: string;
  readonly dispatched: boolean;
  readonly deliveryResults: readonly DeliveryResult[];
  readonly suppressedChannels: readonly string[];
  readonly errors: readonly string[];
}

// ── NotificationEngine PORT ─────────────────────────────────────────────────

/**
 * The NotificationEngine PORT.
 *
 * - `send(notification, now)`        — dispatch immediately; returns the
 *                                       per-channel delivery results.
 * - `schedule(notification, sendAt)` — returns a new Notification with
 *                                       `scheduledFor: sendAt`, `status:
 *                                       "pending"`, stored internally for
 *                                       `listScheduled()`.
 * - `cancel(notificationId)`         — removes a scheduled notification.
 *                                       Returns true if it was found.
 * - `listScheduled()`                — all currently-scheduled notifications,
 *                                       in `scheduledFor` ascending order.
 */
export interface NotificationEngine {
  send(notification: Notification, now: number): NotificationResult;
  schedule(notification: Notification, sendAt: number): Notification;
  cancel(notificationId: string): boolean;
  listScheduled(): readonly Notification[];
}

// Re-export the priority type so callers have it alongside Notification.
export type { MessagePriority, DeliveryResult, UnknownRecord };
