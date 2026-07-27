/**
 * @kernel/protocol-sdk/read-models — protocol-declared read models.
 *
 * A protocol declares a projection (read model) by naming the source event
 * types and an opaque `transformRef` the host application resolves to a real
 * pure `(event, state) → state` function at runtime. The kernel records the
 * contract; the projection engine resolves the implementation.
 */

import type { ProjectionId, SchemaRef } from "@kernel/shared-kernel";
import type { SemverString } from "../manifest/protocol-manifest";

export interface ProtocolReadModel {
  readonly id: ProjectionId;
  readonly ownerProtocolId: string;
  readonly version: SemverString;
  readonly name: string;
  readonly sourceEventTypes: readonly string[];
  readonly targetSchema: SchemaRef;
  /** Opaque ref — resolved to a pure apply function by the host at runtime. */
  readonly transformRef: string;
  readonly description?: string;
}

export interface ReadModelRegistry {
  register(model: ProtocolReadModel): void;
  unregister(protocolId: string): void;
  getById(id: ProjectionId): ProtocolReadModel | undefined;
  list(): readonly ProtocolReadModel[];
  listByProtocol(protocolId: string): readonly ProtocolReadModel[];
  listByEventType(eventType: string): readonly ProtocolReadModel[];
}

export class InMemoryReadModelRegistry implements ReadModelRegistry {
  private readonly byId = new Map<string, ProtocolReadModel>();
  register(m: ProtocolReadModel): void { this.byId.set(String(m.id), m); }
  unregister(protocolId: string): void {
    for (const [id, m] of this.byId) if (m.ownerProtocolId === protocolId) this.byId.delete(id);
  }
  getById(id: ProjectionId): ProtocolReadModel | undefined { return this.byId.get(String(id)); }
  list(): readonly ProtocolReadModel[] { return Array.from(this.byId.values()); }
  listByProtocol(protocolId: string): readonly ProtocolReadModel[] {
    return this.list().filter((m) => m.ownerProtocolId === protocolId);
  }
  listByEventType(eventType: string): readonly ProtocolReadModel[] {
    return this.list().filter((m) => m.sourceEventTypes.includes(eventType));
  }
}
