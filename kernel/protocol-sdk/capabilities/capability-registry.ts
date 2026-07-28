/**
 * @kernel/protocol-sdk/capabilities — the CapabilityRegistry.
 *
 * RICHER than the M1 `CapabilityRegistration`: a protocol-declared capability
 * carries inputs/outputs schemas, requirements, quality metrics, a cost model,
 * tags, and owner-protocol provenance. The runtime resolves capabilities
 * through this registry.
 *
 * The registry is the SDK's store of "what this protocol can do". It is
 * READ-ONLY for the deterministic core; mutation happens only at install time
 * via the ProtocolHost.
 */

import type {
  CapabilityId,
  SchemaRef,
  Constraint,
  UnknownRecord,
} from "@kernel/shared-kernel";
import type { SemverString } from "../manifest/protocol-manifest";

/** A capability input or output port. */
export interface CapabilityPort {
  readonly name: string;
  readonly schema: SchemaRef;
  readonly required: boolean;
  readonly description?: string;
}

/** A requirement a capability imposes on its execution environment. */
export interface CapabilityRequirement {
  readonly kind: string;
  readonly params: UnknownRecord;
}

/** Quality metrics a capability advertises (used for selection / SLAs). */
export interface QualityMetric {
  readonly name: string;
  readonly value: number;
  readonly unit?: string;
  readonly description?: string;
}

/** How a capability is priced (declared, not enforced by the kernel). */
export interface CostModel {
  readonly model: "free" | "fixed" | "per-unit" | "tiered" | "usage";
  readonly amount?: number;
  readonly currency?: string;
  readonly unit?: string;
  readonly description?: string;
}

/**
 * A protocol-declared capability. Realizes the canonical `Capability`
 * primitive with the full provenance the SDK needs for resolution.
 */
export interface ProtocolCapability {
  readonly id: CapabilityId;
  /** Capability type id (matches `manifest.capabilities`). */
  readonly capabilityType: string;
  /** Protocol id that owns this capability. */
  readonly ownerProtocolId: string;
  /** Semver version of THIS capability. */
  readonly version: SemverString;
  readonly inputs: readonly CapabilityPort[];
  readonly outputs: readonly CapabilityPort[];
  readonly requirements: readonly CapabilityRequirement[];
  readonly qualityMetrics: readonly QualityMetric[];
  readonly costModel: CostModel;
  readonly tags: readonly string[];
  readonly constraints: readonly Constraint[];
  readonly description?: string;
}

/** Port: the capability registry. Read-only for the deterministic core. */
export interface CapabilityRegistry {
  register(capability: ProtocolCapability): void;
  unregister(protocolId: string): void;
  getById(id: CapabilityId): ProtocolCapability | undefined;
  getByType(capabilityType: string): readonly ProtocolCapability[];
  list(): readonly ProtocolCapability[];
  listByProtocol(protocolId: string): readonly ProtocolCapability[];
}

/** In-memory `CapabilityRegistry`. */
export class InMemoryCapabilityRegistry implements CapabilityRegistry {
  private readonly byId = new Map<string, ProtocolCapability>();

  register(capability: ProtocolCapability): void {
    this.byId.set(String(capability.id), capability);
  }

  unregister(protocolId: string): void {
    for (const [id, cap] of this.byId) {
      if (cap.ownerProtocolId === protocolId) this.byId.delete(id);
    }
  }

  getById(id: CapabilityId): ProtocolCapability | undefined {
    return this.byId.get(String(id));
  }

  getByType(capabilityType: string): readonly ProtocolCapability[] {
    return Array.from(this.byId.values()).filter(
      (c) => c.capabilityType === capabilityType
    );
  }

  list(): readonly ProtocolCapability[] {
    return Array.from(this.byId.values());
  }

  listByProtocol(protocolId: string): readonly ProtocolCapability[] {
    return Array.from(this.byId.values()).filter(
      (c) => c.ownerProtocolId === protocolId
    );
  }
}
