/**
 * @kernel/integration-hub/infrastructure/in-memory-connector-registry — the
 * reference `ConnectorRegistry` implementation.
 *
 * Pure `Map<string, Connector>` keyed by `connector.id`. `register` replaces
 * any existing entry (idempotent upsert). `listByKind` / `listByProvider`
 * return stable snapshots (insertion order). `updateStatus` produces a new
 * immutable `Connector` value and replaces the stored entry.
 *
 * No `Date.now()`, no `Math.random()`.
 */

import type {
  Connector,
  ConnectorKind,
  ConnectorRegistry,
  ConnectorStatus,
} from "../domain";

export class InMemoryConnectorRegistry implements ConnectorRegistry {
  private readonly connectors = new Map<string, Connector>();

  register(connector: Connector): void {
    this.connectors.set(connector.id, connector);
  }

  get(id: string): Connector | undefined {
    return this.connectors.get(id);
  }

  list(): readonly Connector[] {
    return Array.from(this.connectors.values());
  }

  listByKind(kind: ConnectorKind): readonly Connector[] {
    return Array.from(this.connectors.values()).filter((c) => c.kind === kind);
  }

  listByProvider(provider: string): readonly Connector[] {
    return Array.from(this.connectors.values()).filter(
      (c) => c.provider === provider
    );
  }

  updateStatus(id: string, status: ConnectorStatus): void {
    const c = this.connectors.get(id);
    if (!c) return;
    this.connectors.set(id, { ...c, status });
  }
}
