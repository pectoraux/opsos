/**
 * @kernel/integration-hub/infrastructure — barrel.
 *
 * The infrastructure layer of the Integration Hub. Concrete in-memory
 * implementations of every port. Pure data structures; no `Date.now()`, no
 * `Math.random()`. Suitable for tests, deterministic replay, and as
 * reference implementations for protocol authors.
 *
 * Public surface:
 *   - InMemoryConnectorRegistry
 *   - InMemoryCapabilityRegistry
 *   - InMemoryWebhookRegistry
 *   - InMemorySyncScheduler
 *   - InMemoryRateLimiter
 *   - DemoPaymentConnector   (DEMO — not production PaySwap)
 *   - DemoIntegrationDispatcher (+ DemoIntegrationDispatcherDeps)
 *   - createIntegrationHub() bundle helper
 */

import { InMemoryConnectorRegistry } from "./in-memory-connector-registry";
import { InMemoryCapabilityRegistry } from "./in-memory-capability-registry";
import { InMemoryWebhookRegistry } from "./in-memory-webhook-registry";
import { InMemorySyncScheduler } from "./in-memory-sync-scheduler";
import { InMemoryRateLimiter } from "./in-memory-rate-limiter";
import { DemoPaymentConnector } from "./demo-payment-connector";
import {
  DemoIntegrationDispatcher,
} from "./demo-integration-dispatcher";

export { InMemoryConnectorRegistry } from "./in-memory-connector-registry";
export { InMemoryCapabilityRegistry } from "./in-memory-capability-registry";
export { InMemoryWebhookRegistry } from "./in-memory-webhook-registry";
export { InMemorySyncScheduler } from "./in-memory-sync-scheduler";
export { InMemoryRateLimiter } from "./in-memory-rate-limiter";
export { DemoPaymentConnector } from "./demo-payment-connector";
export { DemoIntegrationDispatcher } from "./demo-integration-dispatcher";
export type { DemoIntegrationDispatcherDeps } from "./demo-integration-dispatcher";

/**
 * A convenience bundle of every in-memory integration-hub component plus the
 * demo dispatcher and demo payment connector. Construct one per session and
 * pass the components individually (or as a bundle) to use-cases.
 */
export interface IntegrationHub {
  readonly connectors: InMemoryConnectorRegistry;
  readonly capabilities: InMemoryCapabilityRegistry;
  readonly webhooks: InMemoryWebhookRegistry;
  readonly syncScheduler: InMemorySyncScheduler;
  readonly rateLimiter: InMemoryRateLimiter;
  readonly paymentConnector: DemoPaymentConnector;
  readonly dispatcher: DemoIntegrationDispatcher;
}

/**
 * Construct a fresh, fully-wired in-memory integration hub. Every component
 * is injected into every dependent: the capability registry gets the
 * connector registry (for `resolve(resource)`); the dispatcher gets both.
 * The demo payment connector stands alone (OpsOS never processes payments
 * itself — this is the PaySwap mock for self-test only).
 */
export function createIntegrationHub(): IntegrationHub {
  const connectors = new InMemoryConnectorRegistry();
  const capabilities = new InMemoryCapabilityRegistry(connectors);
  const webhooks = new InMemoryWebhookRegistry();
  const syncScheduler = new InMemorySyncScheduler();
  const rateLimiter = new InMemoryRateLimiter();
  const paymentConnector = new DemoPaymentConnector();
  const dispatcher = new DemoIntegrationDispatcher({ connectors, capabilities });
  return {
    connectors,
    capabilities,
    webhooks,
    syncScheduler,
    rateLimiter,
    paymentConnector,
    dispatcher,
  };
}
