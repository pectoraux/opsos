/**
 * @kernel/integration-hub/domain — barrel.
 *
 * The domain layer of the Integration Hub. Pure types + ports only — no
 * behaviour, no I/O. Depends ONLY on `@kernel/shared-kernel` (and even that
 * only for the most generic value-object shapes; this module's contracts are
 * self-contained).
 *
 * Public surface:
 *   - Connector:    ConnectorKind, ConnectorStatus, ConnectorConfig,
 *                   Connector, ConnectorRegistry
 *   - Capability:   IntegrationCapabilityKind, IntegrationCapability,
 *                   IntegrationCapabilityRegistry
 *   - Request:      IntegrationRequestStatus, IntegrationRequest,
 *                   IntegrationResponseStatus, IntegrationResponse
 *   - Payment:      PaymentRequest, PaymentStatus, PaymentResult,
 *                   PaymentConnector
 *                   (OpsOS NEVER processes payments itself — all payments
 *                   delegate to PaySwap.)
 *   - Webhook:      WebhookEndpointStatus, WebhookDeliveryStatus,
 *                   WebhookEndpoint, WebhookDelivery, WebhookRegistry
 *   - Sync:         SyncDirection, SyncJobStatus, CronExpression, IntervalMs,
 *                   SyncSchedule, SyncResult, SyncJob, SyncScheduler
 *   - Rate limit:   RateWindow, RateLimit, RateCheckResult, RateLimiter
 *
 * Determinism: no `Date.now()`, no `Math.random()` anywhere in this layer.
 * Every timestamp flows from the caller's `now` argument.
 */

// ── Connector ────────────────────────────────────────────────────────────────
export type {
  ConnectorKind,
  ConnectorStatus,
  ConnectorConfig,
  Connector,
  ConnectorRegistry,
} from "./connector";

// ── Capability ───────────────────────────────────────────────────────────────
export type {
  IntegrationCapabilityKind,
  IntegrationCapability,
  IntegrationCapabilityRegistry,
} from "./integration-capability";

// ── Request ──────────────────────────────────────────────────────────────────
export type {
  IntegrationRequestStatus,
  IntegrationRequest,
  IntegrationResponseStatus,
  IntegrationResponse,
} from "./integration-request";

// ── Payment (THE special connector — delegates to PaySwap only) ──────────────
export type {
  PaymentRequest,
  PaymentStatus,
  PaymentResult,
  PaymentConnector,
} from "./payment-capability";

// ── Webhook ──────────────────────────────────────────────────────────────────
export type {
  WebhookEndpointStatus,
  WebhookDeliveryStatus,
  WebhookEndpoint,
  WebhookDelivery,
  WebhookRegistry,
} from "./webhook";

// ── Sync ─────────────────────────────────────────────────────────────────────
export type {
  SyncDirection,
  SyncJobStatus,
  CronExpression,
  IntervalMs,
  SyncSchedule,
  SyncResult,
  SyncJob,
  SyncScheduler,
} from "./sync-job";

// ── Rate limit ───────────────────────────────────────────────────────────────
export type {
  RateWindow,
  RateLimit,
  RateCheckResult,
  RateLimiter,
} from "./rate-limiter";
