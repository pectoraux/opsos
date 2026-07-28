/**
 * @kernel/integration-hub/application/process-webhook — use-case: receive an
 * inbound webhook event and dispatch it to all registered, active
 * subscribers.
 *
 * Pipeline:
 *   1. Resolve all active `WebhookEndpoint`s subscribed to the event name
 *      via `WebhookRegistry.listByEvent(event)`.
 *   2. For each endpoint, create a `pending` `WebhookDelivery` and ask the
 *      injected `WebhookDeliverer` port to attempt delivery. The deliverer
 *      is the adapter seam — the kernel never makes real HTTP calls.
 *   3. Record each updated delivery via `WebhookRegistry.recordDelivery`.
 *   4. Return the list of deliveries (one per matching endpoint).
 *
 * Determinism: every timestamp flows from `input.now`; delivery ids are
 * derived from `(endpointId, event, now, counter)` — deterministic given
 * the same `now` and call order. No `Date.now()` / `Math.random()`.
 */

import type {
  WebhookDelivery,
  WebhookEndpoint,
  WebhookRegistry,
} from "../domain";

/**
 * The deliverer seam — implemented by adapters in production (real HTTP POST
 * with HMAC signing) and by a deterministic stub in tests / self-test. Pure
 * function of (endpoint, event, payload, now); returns the updated delivery
 * (status sent / failed / retrying) with `attempts` incremented and
 * `lastAttemptAt` stamped.
 */
export interface WebhookDeliverer {
  deliver(
    endpoint: WebhookEndpoint,
    delivery: WebhookDelivery,
    now: number
  ): WebhookDelivery;
}

/** Input to `ProcessWebhook`. */
export interface ProcessWebhookInput {
  readonly event: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly now: number;
}

/** Result of `ProcessWebhook`. */
export interface ProcessWebhookResult {
  readonly endpoints: readonly WebhookEndpoint[];
  readonly deliveries: readonly WebhookDelivery[];
}

/** The use-case port. */
export interface ProcessWebhook {
  execute(input: ProcessWebhookInput): ProcessWebhookResult;
}

/** Dependencies injected into the default implementation. */
export interface ProcessWebhookDeps {
  readonly webhooks: WebhookRegistry;
  readonly deliverer: WebhookDeliverer;
}

/** Default implementation. */
export class ProcessWebhookUseCase implements ProcessWebhook {
  constructor(private readonly deps: ProcessWebhookDeps) {}

  execute(input: ProcessWebhookInput): ProcessWebhookResult {
    const endpoints = this.deps.webhooks.listByEvent(input.event);
    const deliveries: WebhookDelivery[] = [];
    let counter = 0;
    for (const ep of endpoints) {
      counter += 1;
      const deliveryId = `whdel#${ep.id}#${input.event}#${input.now}#${counter}`;
      const pending: WebhookDelivery = {
        id: deliveryId,
        endpointId: ep.id,
        event: input.event,
        payload: input.payload,
        status: "pending",
        attempts: 0,
      };
      const delivered = this.deps.deliverer.deliver(ep, pending, input.now);
      const recorded = this.deps.webhooks.recordDelivery(delivered);
      deliveries.push(recorded);
    }
    return { endpoints, deliveries };
  }
}
