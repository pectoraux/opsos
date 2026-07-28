/**
 * @kernel/integration-hub/infrastructure/demo-integration-dispatcher —
 * DEMO — a deterministic dispatcher for self-test / inspector.
 *
 * Implements the `IntegrationDispatcher` port from the application layer.
 * Resolves connectors via the injected `ConnectorRegistry` and dispatches
 * `IntegrationRequest`s, producing byte-identical `IntegrationResponse`s
 * across runs (given the same inputs).
 *
 * Behaviour:
 *   - Default: success with `data = { connector, capability, operation,
 *     params, dispatchedAt }`. Latency is a deterministic hash of the
 *     request id + operation (no `Math.random()`).
 *   - If `params.__forceError` is a string, returns an `error` response
 *     with that message (latency still deterministic).
 *   - If `params.__forceTimeout` is truthy, returns a `timeout` response.
 *
 * The class also exposes `resolveConnector(connectorId)` and
 * `resolveCapability(resource)` helpers (delegating to the registries) so
 * the inspector / self-test can drive the full resolve→dispatch flow without
 * re-wiring dependencies.
 *
 * Determinism: every timestamp flows from the caller's `now`. The latency
 * hash uses the FNV-1a 32-bit algorithm (pure, no `Math.random()`).
 */

import type { IntegrationDispatcher } from "../application";
import type {
  Connector,
  ConnectorRegistry,
  IntegrationCapability,
  IntegrationCapabilityRegistry,
  IntegrationRequest,
  IntegrationResponse,
} from "../domain";

export interface DemoIntegrationDispatcherDeps {
  readonly connectors: ConnectorRegistry;
  readonly capabilities: IntegrationCapabilityRegistry;
}

export class DemoIntegrationDispatcher implements IntegrationDispatcher {
  constructor(private readonly deps: DemoIntegrationDispatcherDeps) {}

  /** Resolve a connector by id (read-only). */
  resolveConnector(connectorId: string): Connector | undefined {
    return this.deps.connectors.get(connectorId);
  }

  /** Resolve the first active connector serving `resource`. */
  resolveCapability(resource: string): Connector | undefined {
    return this.deps.capabilities.resolve(resource);
  }

  dispatch(
    connector: Connector,
    capability: IntegrationCapability,
    request: IntegrationRequest,
    now: number
  ): IntegrationResponse {
    const latencyMs = deterministicLatency(`${request.id}|${request.operation}`);

    // Force-error injection (self-test only).
    const forceError = request.params?.__forceError;
    if (typeof forceError === "string" && forceError.length > 0) {
      return {
        requestId: request.id,
        status: "error",
        error: forceError,
        latencyMs,
      };
    }

    // Force-timeout injection (self-test only).
    if (request.params?.__forceTimeout) {
      return {
        requestId: request.id,
        status: "timeout",
        error: "demo-forced-timeout",
        latencyMs,
      };
    }

    // Default: success.
    return {
      requestId: request.id,
      status: "success",
      data: {
        connector: { id: connector.id, kind: connector.kind, provider: connector.provider },
        capability: { id: capability.id, resource: capability.resource, kind: capability.kind },
        operation: request.operation,
        params: stripDemoKeys(request.params),
        dispatchedAt: now,
      },
      latencyMs,
    };
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Strip the demo-only `__force*` keys from the echoed params. */
function stripDemoKeys(
  params: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (!k.startsWith("__")) out[k] = v;
  }
  return out;
}

/**
 * FNV-1a 32-bit hash → latency in ms (1..50). Pure function of the input
 * string; deterministic across runs.
 */
function deterministicLatency(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Map to 1..50 inclusive.
  return 1 + (Math.abs(h | 0) % 50);
}
