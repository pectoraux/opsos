/**
 * @kernel/integration-hub/infrastructure/in-memory-capability-registry — the
 * reference `IntegrationCapabilityRegistry` implementation.
 *
 * Capabilities are stored in a `Map<string, IntegrationCapability>` keyed by
 * `capability.id`. `listByConnector` and `listByResource` return stable
 * snapshots. `resolve(resource)` finds the first capability with a matching
 * resource, then looks up its connector via the injected `ConnectorRegistry`
 * — returning the connector only if it is `active`.
 *
 * No `Date.now()`, no `Math.random()`.
 */

import type {
  Connector,
  ConnectorRegistry,
  IntegrationCapability,
  IntegrationCapabilityRegistry,
} from "../domain";

export class InMemoryCapabilityRegistry implements IntegrationCapabilityRegistry {
  private readonly capabilities = new Map<string, IntegrationCapability>();

  constructor(private readonly connectors: ConnectorRegistry) {}

  register(capability: IntegrationCapability): void {
    this.capabilities.set(capability.id, capability);
  }

  get(id: string): IntegrationCapability | undefined {
    return this.capabilities.get(id);
  }

  listByConnector(connectorId: string): readonly IntegrationCapability[] {
    return Array.from(this.capabilities.values()).filter(
      (c) => c.connectorId === connectorId
    );
  }

  listByResource(resource: string): readonly IntegrationCapability[] {
    return Array.from(this.capabilities.values()).filter(
      (c) => c.resource === resource
    );
  }

  resolve(resource: string): Connector | undefined {
    // Stable iteration: first registered capability for the resource wins.
    for (const cap of this.capabilities.values()) {
      if (cap.resource === resource) {
        const connector = this.connectors.get(cap.connectorId);
        if (connector && connector.status === "active") {
          return connector;
        }
      }
    }
    return undefined;
  }
}
