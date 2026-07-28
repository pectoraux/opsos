/**
 * @kernel/integration-hub/infrastructure/in-memory-webhook-registry — the
 * reference `WebhookRegistry` implementation.
 *
 * Endpoints are stored in a `Map<string, WebhookEndpoint>` keyed by `id`;
 * deliveries in a `Map<string, WebhookDelivery>` keyed by `id`. `register`
 * is an idempotent upsert; `unregister` removes the endpoint (deliveries are
 * retained for audit). `listByEvent(event)` returns active endpoints whose
 * `events` array contains the event name. `recordDelivery` is an upsert that
 * returns the stored delivery.
 *
 * No `Date.now()`, no `Math.random()`.
 */

import type {
  WebhookDelivery,
  WebhookEndpoint,
  WebhookRegistry,
} from "../domain";

export class InMemoryWebhookRegistry implements WebhookRegistry {
  private readonly endpoints = new Map<string, WebhookEndpoint>();
  private readonly deliveries = new Map<string, WebhookDelivery>();

  register(endpoint: WebhookEndpoint): void {
    this.endpoints.set(endpoint.id, endpoint);
  }

  unregister(endpointId: string): void {
    this.endpoints.delete(endpointId);
  }

  list(): readonly WebhookEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  listByEvent(event: string): readonly WebhookEndpoint[] {
    return Array.from(this.endpoints.values()).filter(
      (e) => e.status === "active" && e.events.includes(event)
    );
  }

  recordDelivery(delivery: WebhookDelivery): WebhookDelivery {
    this.deliveries.set(delivery.id, delivery);
    return delivery;
  }

  getDelivery(deliveryId: string): WebhookDelivery | undefined {
    return this.deliveries.get(deliveryId);
  }

  listDeliveries(): readonly WebhookDelivery[] {
    return Array.from(this.deliveries.values());
  }
}
