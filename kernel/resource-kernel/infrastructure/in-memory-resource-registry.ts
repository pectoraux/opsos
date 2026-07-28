/**
 * @kernel/resource-kernel/infrastructure/in-memory-resource-registry — the
 * in-memory `ResourceRegistry` implementation. THE port the Coordination
 * Kernel queries.
 *
 * Pure data structures:
 *   - `Map<ResourceId, ResourceRecord>` — canonical resource records
 *   - `Map<CapabilityId, Capability>` — capability lookup (resolves id → type)
 *   - `Map<string, Set<ResourceId>>` — capabilityType → resource ids index
 *   - `Map<LocationId, Set<ResourceId>>` — locationId → resource ids index
 *
 * No `Date.now()`, no `Math.random()`. All time flows through the `now`
 * argument in `FindCapableRequest`.
 *
 * `findCapable` ranking (deterministic, multi-key):
 *   1. available         — `true` first
 *   2. certified         — `true` first
 *   3. remainingCapacity — descending
 *   4. confidence        — descending
 *   5. resourceId        — lexicographic ascending (the determinism anchor)
 *
 * `matchScore` is the numeric encoding of (1..4); the resourceId tiebreak is
 * applied externally to the sort so identical matchScores still produce a
 * total deterministic order.
 */

import type {
  ResourceId,
  CapabilityId,
  LocationId,
} from "@kernel/shared-kernel";
import type {
  ResourceRecord,
  Capability,
} from "@kernel/shared-kernel";
import type { TemporalWindow } from "@kernel/shared-kernel";
import type {
  ResourceRegistry,
  FindCapableRequest,
  CapableResource,
  AvailabilityState,
} from "../domain";
import type { AvailabilityEngine } from "../domain";
import type { CapacityTracker } from "../domain";
import type { SkillRegistry } from "../domain";
import type { LocationResolver } from "../domain";
import {
  AVAILABLE_WEIGHT,
  CERTIFIED_WEIGHT,
  REMAINING_CAPACITY_WEIGHT,
  CONFIDENCE_WEIGHT,
} from "../domain";

export class InMemoryResourceRegistry implements ResourceRegistry {
  private readonly resources = new Map<ResourceId, ResourceRecord>();
  private readonly capabilities = new Map<CapabilityId, Capability>();
  private readonly byCapabilityType = new Map<string, Set<ResourceId>>();
  private readonly byLocation = new Map<LocationId, Set<ResourceId>>();
  private locationResolver: LocationResolver | undefined;

  /**
   * Wires a LocationResolver so `listByLocation` can walk the hierarchy
   * (returns resources in `locationId` OR any descendant). Called by the
   * InMemoryResourceKernel bundle.
   */
  setLocationResolver(resolver: LocationResolver): void {
    this.locationResolver = resolver;
  }

  register(record: ResourceRecord): void {
    const prev = this.resources.get(record.id);
    if (prev) {
      // Clean up prev's capability-type index entries.
      for (const capId of prev.capabilities) {
        const cap = this.capabilities.get(capId);
        if (cap) {
          const set = this.byCapabilityType.get(cap.capabilityType);
          if (set) set.delete(prev.id);
        }
      }
      // Clean up prev's location index entry.
      if (prev.location) {
        const set = this.byLocation.get(prev.location.id);
        if (set) set.delete(prev.id);
      }
    }
    this.resources.set(record.id, record);
    // Index capabilities.
    for (const capId of record.capabilities) {
      const cap = this.capabilities.get(capId);
      if (cap) {
        let set = this.byCapabilityType.get(cap.capabilityType);
        if (!set) {
          set = new Set();
          this.byCapabilityType.set(cap.capabilityType, set);
        }
        set.add(record.id);
      }
    }
    // Index location.
    if (record.location) {
      let set = this.byLocation.get(record.location.id);
      if (!set) {
        set = new Set();
        this.byLocation.set(record.location.id, set);
      }
      set.add(record.id);
    }
  }

  unregister(resourceId: ResourceId): void {
    const prev = this.resources.get(resourceId);
    if (!prev) return;
    for (const capId of prev.capabilities) {
      const cap = this.capabilities.get(capId);
      if (cap) {
        const set = this.byCapabilityType.get(cap.capabilityType);
        if (set) set.delete(prev.id);
      }
    }
    if (prev.location) {
      const set = this.byLocation.get(prev.location.id);
      if (set) set.delete(prev.id);
    }
    this.resources.delete(resourceId);
  }

  get(resourceId: ResourceId): ResourceRecord | undefined {
    return this.resources.get(resourceId);
  }

  list(): readonly ResourceRecord[] {
    return Array.from(this.resources.values());
  }

  listByCapability(capabilityType: string): readonly ResourceRecord[] {
    const set = this.byCapabilityType.get(capabilityType);
    if (!set) return [];
    const out: ResourceRecord[] = [];
    for (const id of set) {
      const r = this.resources.get(id);
      if (r) out.push(r);
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  listByLocation(locationId: LocationId): readonly ResourceRecord[] {
    const out: ResourceRecord[] = [];
    const seen = new Set<ResourceId>();

    // Exact-match resources.
    const direct = this.byLocation.get(locationId);
    if (direct) {
      for (const id of direct) {
        if (!seen.has(id)) {
          const r = this.resources.get(id);
          if (r) {
            out.push(r);
            seen.add(id);
          }
        }
      }
    }

    // Descendant locations (hierarchy walk via the resolver).
    if (this.locationResolver) {
      this.collectDescendantResources(locationId, seen, out);
    }

    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  private collectDescendantResources(
    parentId: LocationId,
    seen: Set<ResourceId>,
    out: ResourceRecord[]
  ): void {
    const children = this.locationResolver!.getChildren(parentId);
    for (const child of children) {
      const set = this.byLocation.get(child.id);
      if (set) {
        for (const id of set) {
          if (!seen.has(id)) {
            const r = this.resources.get(id);
            if (r) {
              out.push(r);
              seen.add(id);
            }
          }
        }
      }
      // Recurse.
      this.collectDescendantResources(child.id, seen, out);
    }
  }

  listByAvailability(
    state: AvailabilityState,
    window?: TemporalWindow
  ): readonly ResourceRecord[] {
    // The AvailabilityEngine is the source of truth for state — but the
    // registry does NOT hold a reference to it. This method returns resources
    // whose `health.operationalState` matches `state`. The caller is expected
    // to subsequently call `availability.isAvailable` for window-gating.
    const out: ResourceRecord[] = [];
    for (const r of this.resources.values()) {
      if (r.health.operationalState === state) {
        if (window) {
          // Window-gate is best-effort: include resources whose health state
          // matches. The actual availability check happens via the engine.
          out.push(r);
        } else {
          out.push(r);
        }
      }
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  registerCapability(capability: Capability): void {
    const prev = this.capabilities.get(capability.id);
    this.capabilities.set(capability.id, capability);
    if (prev && prev.capabilityType !== capability.capabilityType) {
      const oldSet = this.byCapabilityType.get(prev.capabilityType);
      if (oldSet) oldSet.delete(capability.providerId);
    }
    // Index the provider resource under the capability type — but only if
    // the provider is registered.
    if (this.resources.has(capability.providerId)) {
      let set = this.byCapabilityType.get(capability.capabilityType);
      if (!set) {
        set = new Set();
        this.byCapabilityType.set(capability.capabilityType, set);
      }
      set.add(capability.providerId);
    }
  }

  getCapability(capabilityId: CapabilityId): Capability | undefined {
    return this.capabilities.get(capabilityId);
  }

  findCapable(
    request: FindCapableRequest,
    availability: AvailabilityEngine,
    capacity: CapacityTracker,
    skills: SkillRegistry
  ): readonly CapableResource[] {
    const candidates = this.listByCapability(request.capabilityType);
    const out: CapableResource[] = [];

    for (const resource of candidates) {
      const available = availability.isAvailable(
        resource.id,
        request.window,
        request.now
      );
      const remainingCapacity = capacity.getRemaining(resource.id);
      const certified = skills.isCertifiedAt(
        resource.id,
        request.capabilityType,
        0,
        request.now
      );
      const confidence = skills.getConfidenceAt(
        resource.id,
        request.capabilityType,
        request.now
      );

      const matchScore = computeMatchScore(
        available,
        certified,
        remainingCapacity,
        confidence
      );

      out.push({
        resource,
        matchScore,
        available,
        remainingCapacity,
        certified,
        confidence,
      });
    }

    // Multi-key sort: available DESC, certified DESC, remainingCapacity DESC,
    // confidence DESC, resourceId ASC.
    out.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      if (a.certified !== b.certified) return a.certified ? -1 : 1;
      if (a.remainingCapacity !== b.remainingCapacity) {
        return b.remainingCapacity - a.remainingCapacity;
      }
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }
      return a.resource.id < b.resource.id
        ? -1
        : a.resource.id > b.resource.id
          ? 1
          : 0;
    });

    return out;
  }
}

/**
 * Compute the numeric matchScore encoding (available, certified,
 * remainingCapacity, confidence). The resourceId tiebreak is NOT encoded —
 * it's applied externally via the sort. `matchScore` is for display / coarse
 * ranking only.
 *
 *   matchScore = (available ? AVAILABLE_WEIGHT : 0)
 *              + (certified ? CERTIFIED_WEIGHT : 0)
 *              + Math.min(remainingCapacity, 999_999) * REMAINING_CAPACITY_WEIGHT
 *              + Math.floor(confidence * 1000) * (CONFIDENCE_WEIGHT / 1000)
 *
 * The clamps prevent weight collisions when capacity / confidence are large.
 */
export function computeMatchScore(
  available: boolean,
  certified: boolean,
  remainingCapacity: number,
  confidence: number
): number {
  const a = available ? AVAILABLE_WEIGHT : 0;
  const c = certified ? CERTIFIED_WEIGHT : 0;
  const cap = Math.min(Math.max(remainingCapacity, 0), 999_999) * REMAINING_CAPACITY_WEIGHT;
  const conf = Math.floor(Math.max(0, Math.min(1, confidence)) * 1000);
  return a + c + cap + conf;
}
