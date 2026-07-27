/**
 * @kernel/protocol-sdk/pricing — protocol-declared pricing models.
 *
 * Declared only — the kernel does NOT enforce or compute prices. A future
 * billing service consumes these declarations.
 */

import type { SemverString } from "../manifest/protocol-manifest";

export interface PricingTier {
  readonly name: string;
  readonly amount: number;
  readonly currency: string;
  readonly unit?: string;
  readonly description?: string;
}

export interface ProtocolPricing {
  readonly id: string;
  readonly ownerProtocolId: string;
  readonly version: SemverString;
  readonly model: "free" | "fixed" | "per-unit" | "tiered" | "usage";
  readonly currency: string;
  readonly tiers: readonly PricingTier[];
  readonly description?: string;
}

export interface PricingRegistry {
  register(pricing: ProtocolPricing): void;
  unregister(protocolId: string): void;
  getById(id: string): ProtocolPricing | undefined;
  list(): readonly ProtocolPricing[];
  listByProtocol(protocolId: string): readonly ProtocolPricing[];
}

export class InMemoryPricingRegistry implements PricingRegistry {
  private readonly byId = new Map<string, ProtocolPricing>();
  register(p: ProtocolPricing): void { this.byId.set(p.id, p); }
  unregister(protocolId: string): void {
    for (const [id, p] of this.byId) if (p.ownerProtocolId === protocolId) this.byId.delete(id);
  }
  getById(id: string): ProtocolPricing | undefined { return this.byId.get(id); }
  list(): readonly ProtocolPricing[] { return Array.from(this.byId.values()); }
  listByProtocol(protocolId: string): readonly ProtocolPricing[] {
    return this.list().filter((p) => p.ownerProtocolId === protocolId);
  }
}
