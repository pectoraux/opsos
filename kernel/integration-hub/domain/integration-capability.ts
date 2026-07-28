/**
 * @kernel/integration-hub/domain/integration-capability — the
 * IntegrationCapability primitive and its registry port.
 *
 * An `IntegrationCapability` is a single operation surface exposed by a
 * connector: e.g. `calendar.events` (read), `payment.charge` (write),
 * `crm.contacts` (sync), `iot.telemetry` (stream), `ai.complete` (query).
 * Capabilities are how the rest of OpsOS discovers *what* it can call on a
 * connector and *how* (read / write / sync / webhook / stream / query).
 *
 * The `IntegrationCapabilityRegistry` PORT supports lookup by connector,
 * by resource, and a `resolve(resource)` that returns the first connector
 * registered to serve that resource.
 *
 * Determinism: capabilities are pure data; registries are Maps. No
 * `Date.now()` / `Math.random()`.
 */

/** How a capability is consumed. */
export type IntegrationCapabilityKind =
  | "read"
  | "write"
  | "sync"
  | "webhook"
  | "stream"
  | "query";

/** A single operation surface exposed by a connector. */
export interface IntegrationCapability {
  readonly id: string;
  readonly connectorId: string;
  readonly kind: IntegrationCapabilityKind;
  /** Resource string, e.g. "calendar.events", "payment.charge". */
  readonly resource: string;
  /** Optional reference to a schema describing the operation payload. */
  readonly schemaRef?: string;
}

/**
 * The port implemented by `InMemoryCapabilityRegistry`. Stores capabilities
 * and supports lookup by id, connector, and resource. `resolve(resource)`
 * returns the first connector that serves the resource (via the
 * `ConnectorRegistry`), or `undefined` if none.
 */
export interface IntegrationCapabilityRegistry {
  register(capability: IntegrationCapability): void;
  get(id: string): IntegrationCapability | undefined;
  listByConnector(connectorId: string): readonly IntegrationCapability[];
  listByResource(resource: string): readonly IntegrationCapability[];
  /**
   * Resolve the first active connector that serves `resource`. Returns
   * `undefined` when no connector is registered or none is active.
   */
  resolve(resource: string): Connector | undefined;
}

// Forward type-only import to surface the Connector dependency without
// creating a runtime cycle. The registry implementation wires the actual
// `ConnectorRegistry` instance.
import type { Connector } from "./connector";
