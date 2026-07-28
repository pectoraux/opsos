/**
 * @kernel/integration-hub/domain/webhook — the WebhookEndpoint and
 * WebhookDelivery primitives, plus the WebhookRegistry port.
 *
 * OpsOS exposes capabilities; protocols (and external systems) consume them.
 * External systems push data into OpsOS via webhooks: a `WebhookEndpoint` is
 * a registered subscriber (URL + event filters + secret), a
 * `WebhookDelivery` is a single attempt to deliver an event to an endpoint.
 *
 * The `WebhookRegistry` PORT supports registration, unregistration, listing,
 * and lookup by event name.
 *
 * Determinism: deliveries are pure data; the registry is a Map. No
 * `Date.now()` / `Math.random()` — every timestamp flows from the caller's
 * `now` argument.
 */

/** Lifecycle state of a webhook endpoint. */
export type WebhookEndpointStatus = "active" | "disabled";

/** Lifecycle state of a webhook delivery. */
export type WebhookDeliveryStatus =
  | "pending"
  | "sent"
  | "failed"
  | "retrying";

/** A registered webhook subscriber. */
export interface WebhookEndpoint {
  readonly id: string;
  readonly url: string;
  /** Event name filters, e.g. ["payment.succeeded", "calendar.updated"]. */
  readonly events: readonly string[];
  /** Shared secret for HMAC signing of delivery payloads. */
  readonly secret: string;
  readonly status: WebhookEndpointStatus;
}

/** A single attempt to deliver an event to an endpoint. */
export interface WebhookDelivery {
  readonly id: string;
  readonly endpointId: string;
  /** Event name being delivered. */
  readonly event: string;
  /** Payload to deliver (serialisable). */
  readonly payload: Readonly<Record<string, unknown>>;
  readonly status: WebhookDeliveryStatus;
  /** Number of delivery attempts so far. */
  readonly attempts: number;
  /** Epoch-ms of the last attempt, if any. */
  readonly lastAttemptAt?: number;
  /** Epoch-ms of successful delivery, if any. */
  readonly deliveredAt?: number;
}

/**
 * The port implemented by `InMemoryWebhookRegistry`. Stores endpoints and
 * deliveries, supports registration / unregistration / listing, and lookup
 * by event name (endpoints whose `events` array contains the event).
 */
export interface WebhookRegistry {
  register(endpoint: WebhookEndpoint): void;
  unregister(endpointId: string): void;
  list(): readonly WebhookEndpoint[];
  /** All active endpoints subscribed to the given event name. */
  listByEvent(event: string): readonly WebhookEndpoint[];
  /** Record a delivery attempt (returns the updated delivery). */
  recordDelivery(delivery: WebhookDelivery): WebhookDelivery;
  /** Look up a delivery by id. */
  getDelivery(deliveryId: string): WebhookDelivery | undefined;
  /** All deliveries (snapshot, read-only). */
  listDeliveries(): readonly WebhookDelivery[];
}
