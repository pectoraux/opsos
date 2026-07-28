/**
 * @kernel/integration-hub/domain/integration-request — the request/response
 * primitives that flow through the integration hub.
 *
 * An `IntegrationRequest` is the canonical envelope for a call OpsOS makes
 * against an external system via a connector: which connector, which
 * capability, which operation, with which params, and at what stage of the
 * request lifecycle (pending → in-flight → completed | failed | timeout).
 *
 * An `IntegrationResponse` is the canonical envelope returned by the
 * dispatcher: a request id, a success / error / timeout status, an optional
 * data blob, an optional error message, and the measured latency in
 * milliseconds.
 *
 * Determinism: every timestamp flows from the caller's `now` argument; the
 * latency is computed from caller-supplied time, not `Date.now()`.
 */

/** Lifecycle state of an integration request. */
export type IntegrationRequestStatus =
  | "pending"
  | "in-flight"
  | "completed"
  | "failed"
  | "timeout";

/** A request to execute an integration operation. */
export interface IntegrationRequest {
  readonly id: string;
  readonly connectorId: string;
  readonly capabilityId: string;
  /** Operation name, e.g. "list", "create", "charge", "refund". */
  readonly operation: string;
  /** Operation parameters (serialisable). */
  readonly params: Readonly<Record<string, unknown>>;
  readonly status: IntegrationRequestStatus;
  /** Correlation id echoed back in the response, if assigned. */
  readonly requestId?: string;
  /** Epoch-ms timestamp sourced from the caller's `now`. */
  readonly timestamp: number;
}

/** Response status returned by the dispatcher. */
export type IntegrationResponseStatus = "success" | "error" | "timeout";

/** A response returned by the integration dispatcher. */
export interface IntegrationResponse {
  readonly requestId: string;
  readonly status: IntegrationResponseStatus;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly error?: string;
  /** Latency in milliseconds, derived from caller-supplied time. */
  readonly latencyMs: number;
}
