/**
 * @kernel/protocol-sdk/events — protocol-declared event types.
 *
 * Protocols declare the event types they emit, with an opaque schema ref. The
 * kernel records these so the projection engine, analytics, and audit can
 * subscribe to known event streams.
 */

import type { SchemaRef } from "@kernel/shared-kernel";
import type { SemverString } from "../manifest/protocol-manifest";

export interface ProtocolEventType {
  readonly eventType: string;
  readonly ownerProtocolId: string;
  readonly version: SemverString;
  readonly payloadSchema: SchemaRef;
  readonly description?: string;
}

export interface EventTypeRegistry {
  register(et: ProtocolEventType): void;
  unregister(protocolId: string): void;
  getByType(eventType: string): ProtocolEventType | undefined;
  list(): readonly ProtocolEventType[];
  listByProtocol(protocolId: string): readonly ProtocolEventType[];
}

export class InMemoryEventTypeRegistry implements EventTypeRegistry {
  private readonly byType = new Map<string, ProtocolEventType>();
  register(et: ProtocolEventType): void { this.byType.set(et.eventType, et); }
  unregister(protocolId: string): void {
    for (const [t, e] of this.byType) if (e.ownerProtocolId === protocolId) this.byType.delete(t);
  }
  getByType(eventType: string): ProtocolEventType | undefined { return this.byType.get(eventType); }
  list(): readonly ProtocolEventType[] { return Array.from(this.byType.values()); }
  listByProtocol(protocolId: string): readonly ProtocolEventType[] {
    return this.list().filter((e) => e.ownerProtocolId === protocolId);
  }
}
