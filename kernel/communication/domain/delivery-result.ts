/**
 * @kernel/communication/domain/delivery-result — the per-message delivery
 * outcome returned by a channel adapter (or, in the in-memory implementation,
 * synthesised by the engine).
 *
 * The NotificationEngine collects one DeliveryResult per Message it dispatches
 * and bundles them into NotificationResult.deliveryResults.
 *
 * Determinism: pure data. `deliveredAt` is epoch-millis from the caller's
 * `now`; never `Date.now()`.
 */
/**
 * The status of a delivery attempt, as reported by the channel adapter.
 *
 * - `sent`      — handed to the provider; awaiting confirmation.
 * - `delivered` — provider confirmed delivery.
 * - `failed`    — provider rejected the message (validation, auth, rate-limit,
 *                 suppression). Terminal for this attempt.
 * - `bounced`   — provider accepted then bounced. May trigger an automatic
 *                 suppression-list entry for the recipient+channelKind.
 * - `pending`   — queued for delivery but not yet dispatched (e.g. scheduled).
 */
export type DeliveryStatus = "sent" | "delivered" | "failed" | "bounced" | "pending";

/**
 * The per-message delivery outcome.
 *
 * `providerRef` is the provider's id for the sent message (e.g. the FCM
 * message id, the Twilio message sid). The platform stores it so inbound
 * webhooks (delivery receipts, bounce notifications) can be correlated back.
 *
 * `error` is a human-readable error message for failed/bounced deliveries.
 */
export interface DeliveryResult {
  readonly messageId: string;
  readonly channelId: string;
  readonly status: DeliveryStatus;
  readonly providerRef?: string;
  readonly error?: string;
  readonly deliveredAt?: number;
}
