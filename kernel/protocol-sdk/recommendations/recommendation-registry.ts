/**
 * @kernel/protocol-sdk/recommendations — protocol-declared recommendation
 * providers.
 *
 * A recommendation provider is an opaque ref the host resolves to a function
 * that produces `Recommendation`s. The kernel records the contract; it does
 * not produce recommendations itself.
 */

import type { SemverString } from "../manifest/protocol-manifest";

export interface RecommendationProvider {
  readonly id: string;
  readonly ownerProtocolId: string;
  readonly version: SemverString;
  readonly name: string;
  readonly source: "simulation" | "analysis" | "policy";
  readonly targetKind: "intent" | "task" | "plan" | "resource";
  readonly providerRef: string;
  readonly description?: string;
}

export interface RecommendationRegistry {
  register(provider: RecommendationProvider): void;
  unregister(protocolId: string): void;
  getById(id: string): RecommendationProvider | undefined;
  list(): readonly RecommendationProvider[];
  listByProtocol(protocolId: string): readonly RecommendationProvider[];
  listByTarget(targetKind: string): readonly RecommendationProvider[];
}

export class InMemoryRecommendationRegistry implements RecommendationRegistry {
  private readonly byId = new Map<string, RecommendationProvider>();
  register(p: RecommendationProvider): void { this.byId.set(p.id, p); }
  unregister(protocolId: string): void {
    for (const [id, p] of this.byId) if (p.ownerProtocolId === protocolId) this.byId.delete(id);
  }
  getById(id: string): RecommendationProvider | undefined { return this.byId.get(id); }
  list(): readonly RecommendationProvider[] { return Array.from(this.byId.values()); }
  listByProtocol(protocolId: string): readonly RecommendationProvider[] {
    return this.list().filter((p) => p.ownerProtocolId === protocolId);
  }
  listByTarget(targetKind: string): readonly RecommendationProvider[] {
    return this.list().filter((p) => p.targetKind === targetKind);
  }
}
