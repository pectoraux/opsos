/**
 * @kernel/integration-hub/infrastructure/demo-payment-connector —
 * DEMO — NOT a production PaySwap integration.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  OpsOS NEVER processes payments itself — all payments delegate to PaySwap. │
 * │  This is a deterministic PaySwap MOCK for self-test, inspector, and        │
 * │  deterministic replay ONLY. It ALWAYS succeeds (charge → succeeded,        │
 * │  refund → refunded, getStatus → echoes the last recorded status). It       │
 * │  MUST be replaced by a real PaySwap adapter in production.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * The mock keeps an internal `Map<paymentId, PaymentResult>` so that
 * `getStatus` returns the status set by the most recent `charge` or
 * `refund`. The `providerRef` is derived deterministically from the payment
 * id (no `Math.random()`): `"payswap#" + paymentId`. The `provider` is
 * always `"payswap"`.
 *
 * Determinism: every timestamp flows from the caller's `now`. No
 * `Date.now()`, no `Math.random()`.
 */

import type {
  PaymentConnector,
  PaymentRequest,
  PaymentResult,
  PaymentStatus,
} from "../domain";

export class DemoPaymentConnector implements PaymentConnector {
  private readonly payments = new Map<string, PaymentResult>();

  charge(request: PaymentRequest, now: number): PaymentResult {
    const result: PaymentResult = {
      id: request.id,
      status: "succeeded",
      providerRef: `payswap#${request.id}`,
      provider: "payswap",
      processedAt: now,
    };
    this.payments.set(request.id, result);
    return result;
  }

  refund(paymentId: string, _amount: number | undefined, now: number): PaymentResult {
    const existing = this.payments.get(paymentId);
    const result: PaymentResult = {
      id: paymentId,
      status: "refunded",
      providerRef: existing?.providerRef ?? `payswap#${paymentId}`,
      provider: "payswap",
      processedAt: now,
    };
    this.payments.set(paymentId, result);
    return result;
  }

  getStatus(paymentId: string): PaymentStatus {
    return this.payments.get(paymentId)?.status ?? "pending";
  }

  /** Test/inspector helper — expose the recorded payment, if any. */
  get(paymentId: string): PaymentResult | undefined {
    return this.payments.get(paymentId);
  }
}
