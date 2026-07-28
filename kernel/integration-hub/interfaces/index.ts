/**
 * @kernel/integration-hub — public surface.
 *
 * The Integration Hub — universal connectors for every operational business:
 * calendars, payments (through PaySwap only — OpsOS never processes payments
 * itself), maps, identity, accounting, ERP, CRM, IoT, AI providers, and
 * custom. The platform exposes capabilities; protocols consume them.
 *
 * Layered dependency direction:
 *   `interfaces/ → application/ → domain/`
 *   `infrastructure/ → application/ → domain/`
 *   `domain/` depends ONLY on `@kernel/shared-kernel`.
 *
 * Public surface:
 *   - Domain:          ConnectorKind, ConnectorStatus, ConnectorConfig,
 *                      Connector, ConnectorRegistry;
 *                      IntegrationCapabilityKind, IntegrationCapability,
 *                      IntegrationCapabilityRegistry;
 *                      IntegrationRequestStatus, IntegrationRequest,
 *                      IntegrationResponseStatus, IntegrationResponse;
 *                      PaymentRequest, PaymentStatus, PaymentResult,
 *                      PaymentConnector (PaySwap only);
 *                      WebhookEndpointStatus, WebhookDeliveryStatus,
 *                      WebhookEndpoint, WebhookDelivery, WebhookRegistry;
 *                      SyncDirection, SyncJobStatus, CronExpression,
 *                      IntervalMs, SyncSchedule, SyncResult, SyncJob,
 *                      SyncScheduler;
 *                      RateWindow, RateLimit, RateCheckResult, RateLimiter
 *   - Application:     ExecuteIntegration (+UseCase, IntegrationDispatcher),
 *                      ProcessWebhook (+UseCase, WebhookDeliverer),
 *                      RunSync (+UseCase, SyncExecutor)
 *   - Infrastructure:  InMemoryConnectorRegistry, InMemoryCapabilityRegistry,
 *                      InMemoryWebhookRegistry, InMemorySyncScheduler,
 *                      InMemoryRateLimiter, DemoPaymentConnector (DEMO),
 *                      DemoIntegrationDispatcher, createIntegrationHub()
 *
 * Determinism guarantees (enforced):
 *   - NO `Date.now()` / `Math.random()` anywhere in this module.
 *   - All time flows through the `now` argument.
 *   - All stores are pure data structures (Maps).
 *   - Cron expansion uses `new Date(ms).getUTC*()` — a PURE function of the
 *     epoch-ms argument (no wall clock).
 *   - Demo dispatcher latency is a pure FNV-1a hash of the request id +
 *     operation (no `Math.random()`).
 *
 * Payment processing (THE special connector):
 *   - OpsOS NEVER processes payments itself — all payments delegate to
 *     PaySwap. The `PaymentConnector` port is a thin façade; the
 *     `DemoPaymentConnector` is for self-test / inspector only and MUST be
 *     replaced by a real PaySwap adapter in production.
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
