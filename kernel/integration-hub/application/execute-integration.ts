/**
 * @kernel/integration-hub/application/execute-integration — use-case: execute
 * an integration request against an external system.
 *
 * Pipeline:
 *   1. Resolve the connector by id (must be `active`).
 *   2. Resolve the capability by id (must belong to the connector).
 *   3. Check the rate limiter — abort with a rate-limit error if denied.
 *   4. Dispatch the request via the `IntegrationDispatcher` port (the
 *      dispatcher is the adapter seam; the kernel never makes real HTTP
 *      calls — the DemoIntegrationDispatcher produces deterministic
 *      responses for self-test / inspector).
 *   5. Record the consumed capacity on success.
 *   6. Return the response (success / error / timeout).
 *
 * Determinism: every timestamp flows from `input.now`. The latency is
 * computed as `end - now` from caller-supplied time, not `Date.now()`.
 */

import {
  NotFoundError,
  IllegalStateError,
  LimitExceededError,
  type Result,
  ok,
  err,
} from "@kernel/shared-kernel";

import type {
  Connector,
  ConnectorRegistry,
  IntegrationCapability,
  IntegrationCapabilityRegistry,
  IntegrationRequest,
  IntegrationResponse,
  RateLimiter,
} from "../domain";

/**
 * The dispatcher seam — implemented by `DemoIntegrationDispatcher` (self-test)
 * and by real adapter hosts in production. Pure function of (connector,
 * capability, request, now); produces a deterministic `IntegrationResponse`.
 */
export interface IntegrationDispatcher {
  dispatch(
    connector: Connector,
    capability: IntegrationCapability,
    request: IntegrationRequest,
    now: number
  ): IntegrationResponse;
}

/** Input to `ExecuteIntegration`. */
export interface ExecuteIntegrationInput {
  readonly connectorId: string;
  readonly capabilityId: string;
  readonly operation: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly requestId: string;
  readonly now: number;
}

/** Result of `ExecuteIntegration`. */
export interface ExecuteIntegrationResult {
  readonly request: IntegrationRequest;
  readonly response: IntegrationResponse;
}

/** The use-case port. */
export interface ExecuteIntegration {
  execute(input: ExecuteIntegrationInput): Result<ExecuteIntegrationResult>;
}

/** Dependencies injected into the default implementation. */
export interface ExecuteIntegrationDeps {
  readonly connectors: ConnectorRegistry;
  readonly capabilities: IntegrationCapabilityRegistry;
  readonly rateLimiter: RateLimiter;
  readonly dispatcher: IntegrationDispatcher;
}

/** Default implementation. */
export class ExecuteIntegrationUseCase implements ExecuteIntegration {
  constructor(private readonly deps: ExecuteIntegrationDeps) {}

  execute(input: ExecuteIntegrationInput): Result<ExecuteIntegrationResult> {
    const connector = this.deps.connectors.get(input.connectorId);
    if (!connector) {
      return err(new NotFoundError("Connector", input.connectorId));
    }
    if (connector.status !== "active") {
      return err(
        new IllegalStateError(
          `Connector '${connector.id}' is ${connector.status} (must be active)`
        )
      );
    }

    const capability = this.deps.capabilities.get(input.capabilityId);
    if (!capability) {
      return err(new NotFoundError("IntegrationCapability", input.capabilityId));
    }
    if (capability.connectorId !== connector.id) {
      return err(
        new IllegalStateError(
          `Capability '${capability.id}' does not belong to connector '${connector.id}'`
        )
      );
    }

    // Rate-limit check (non-mutating).
    const rl = this.deps.rateLimiter.check(connector.id);
    if (!rl.allowed) {
      return err(
        new LimitExceededError(
          `Rate limit for connector '${connector.id}' exceeded; resets at ${rl.resetAt}`
        )
      );
    }

    // Build the in-flight request envelope.
    const request: IntegrationRequest = {
      id: input.requestId,
      connectorId: connector.id,
      capabilityId: capability.id,
      operation: input.operation,
      params: input.params,
      status: "in-flight",
      requestId: input.requestId,
      timestamp: input.now,
    };

    // Dispatch.
    const response = this.deps.dispatcher.dispatch(
      connector,
      capability,
      request,
      input.now
    );

    // Consume capacity only on a non-timeout outcome (timeouts still cost a
    // call but we keep the bookkeeping conservative: record on every
    // dispatched request).
    this.deps.rateLimiter.record(connector.id, input.now);

    return ok({ request, response });
  }
}
