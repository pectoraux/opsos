/**
 * @kernel/integration-hub/domain/payment-capability — THE special connector.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  OpsOS NEVER processes payments itself — all payments delegate to PaySwap. │
 * │  The PaymentConnector port is a thin façade over the PaySwap adapter.     │
 * │  The kernel defines only the contract; the actual PaySwap integration     │
 * │  (HTTP, signing, idempotency keys, webhooks) lives in an adapter outside  │
 * │  the deterministic core. The DemoPaymentConnector is for self-test only.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * `PaymentRequest` is the canonical input: amount, currency, description,
 * optional customer id, optional metadata. `PaymentResult` is the canonical
 * output: a status (pending | succeeded | failed | refunded), a provider
 * reference, the fixed provider slug `"payswap"`, and the processed-at
 * timestamp. `PaymentStatus` is the lifecycle state of a single payment.
 *
 * The `PaymentConnector` PORT exposes three operations:
 *   - `charge(request, now)` — initiate a charge via PaySwap
 *   - `refund(paymentId, amount?, now)` — refund (full or partial) via PaySwap
 *   - `getStatus(paymentId)` — query the current status of a payment
 *
 * Determinism: every timestamp flows from the caller's `now` argument. The
 * `providerRef` is sourced from PaySwap in production; the demo returns a
 * deterministic value derived from the request id.
 */

/** A request to charge a customer via PaySwap. */
export interface PaymentRequest {
  readonly id: string;
  readonly amount: number;
  /** ISO 4217 currency code, e.g. "USD". */
  readonly currency: string;
  readonly description: string;
  readonly customerId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Lifecycle state of a payment. */
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

/** The result of a payment operation — always provider `"payswap"`. */
export interface PaymentResult {
  readonly id: string;
  readonly status: PaymentStatus;
  /** PaySwap's reference for this payment / refund. */
  readonly providerRef: string;
  /** Always `"payswap"` — OpsOS never processes payments itself. */
  readonly provider: "payswap";
  /** Epoch-ms timestamp sourced from the caller's `now`. */
  readonly processedAt: number;
}

/**
 * THE special connector. Implemented by `DemoPaymentConnector` (self-test)
 * and by the real PaySwap adapter (production). The kernel never processes
 * payments — it delegates exclusively to PaySwap.
 */
export interface PaymentConnector {
  charge(request: PaymentRequest, now: number): PaymentResult;
  refund(paymentId: string, amount: number | undefined, now: number): PaymentResult;
  getStatus(paymentId: string): PaymentStatus;
}
