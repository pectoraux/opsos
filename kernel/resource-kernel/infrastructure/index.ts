/**
 * @kernel/resource-kernel/infrastructure — barrel.
 *
 * The infrastructure layer of the Resource Kernel. Concrete in-memory
 * implementations of every port. Pure data structures; no `Date.now()`, no
 * `Math.random()`. Suitable for tests, deterministic replay, and as reference
 * implementations for protocol authors.
 *
 * Public surface:
 *   - InMemoryResourceRegistry
 *   - InMemoryAvailabilityEngine
 *   - InMemoryCapacityTracker
 *   - InMemoryLocationResolver
 *   - InMemoryResourceCalendar
 *   - InMemorySkillRegistry
 *   - InMemoryTwinManager
 *   - InMemoryMaintenanceTracker
 *   - InMemoryQualityMetrics
 *   - InMemoryResourceKernel (bundle interface)
 *   - createInMemoryResourceKernel() (bundle helper)
 *   - computeMatchScore (the scoring function used by findCapable)
 */

import { InMemoryResourceRegistry } from "./in-memory-resource-registry";
import { InMemoryAvailabilityEngine } from "./in-memory-availability-engine";
import { InMemoryCapacityTracker } from "./in-memory-capacity-tracker";
import { InMemoryLocationResolver } from "./in-memory-location-resolver";
import { InMemoryResourceCalendar } from "./in-memory-resource-calendar";
import { InMemorySkillRegistry } from "./in-memory-skill-registry";
import { InMemoryTwinManager } from "./in-memory-twin-manager";
import { InMemoryMaintenanceTracker } from "./in-memory-maintenance-tracker";
import { InMemoryQualityMetrics } from "./in-memory-quality-metrics";

export { InMemoryResourceRegistry } from "./in-memory-resource-registry";
export { InMemoryAvailabilityEngine } from "./in-memory-availability-engine";
export { InMemoryCapacityTracker } from "./in-memory-capacity-tracker";
export { InMemoryLocationResolver } from "./in-memory-location-resolver";
export { InMemoryResourceCalendar } from "./in-memory-resource-calendar";
export { InMemorySkillRegistry } from "./in-memory-skill-registry";
export { InMemoryTwinManager } from "./in-memory-twin-manager";
export { InMemoryMaintenanceTracker } from "./in-memory-maintenance-tracker";
export { InMemoryQualityMetrics } from "./in-memory-quality-metrics";
export { computeMatchScore } from "./in-memory-resource-registry";

import type { ResourceRecord, Capability } from "@kernel/shared-kernel";

/**
 * A convenience bundle of every in-memory resource-kernel component.
 * Construct one per resource-kernel session and pass the components
 * individually (or as a bundle) to use-cases like `FindCapableResourcesUseCase`.
 *
 * The bundle wires internal cross-references:
 *   - `registry.setLocationResolver(locations)` so `listByLocation` walks the
 *     hierarchy.
 *
 * Registering a resource via `registerResource(record)` propagates the
 * resource's twin to `twinManager.initTwin` and (if the resource carries a
 * capacity envelope in `attributes.capacity`) seeds the capacity tracker.
 */
export interface InMemoryResourceKernel {
  readonly registry: InMemoryResourceRegistry;
  readonly availability: InMemoryAvailabilityEngine;
  readonly capacity: InMemoryCapacityTracker;
  readonly locations: InMemoryLocationResolver;
  readonly calendar: InMemoryResourceCalendar;
  readonly skills: InMemorySkillRegistry;
  readonly twins: InMemoryTwinManager;
  readonly maintenance: InMemoryMaintenanceTracker;
  readonly quality: InMemoryQualityMetrics;

  /**
   * Convenience: registers a resource AND wires its twin into the twin
   * manager. The resource's `health.operationalState` is propagated to the
   * availability engine via `setState`.
   */
  registerResource(record: ResourceRecord, now: number): void;
  /** Convenience: registers a capability. */
  registerCapability(capability: Capability): void;
}

/**
 * Construct a fresh bundle of in-memory resource-kernel components. Each
 * component is a new instance with empty state.
 *
 * @param qualityWindowSize optional rolling-window size for the quality
 *   metrics engine (defaults to `DEFAULT_QUALITY_WINDOW_SIZE`).
 */
export function createInMemoryResourceKernel(
  qualityWindowSize?: number
): InMemoryResourceKernel {
  const registry = new InMemoryResourceRegistry();
  const availability = new InMemoryAvailabilityEngine();
  const capacity = new InMemoryCapacityTracker();
  const locations = new InMemoryLocationResolver();
  const calendar = new InMemoryResourceCalendar();
  const skills = new InMemorySkillRegistry();
  const twins = new InMemoryTwinManager();
  const maintenance = new InMemoryMaintenanceTracker();
  const quality = new InMemoryQualityMetrics(qualityWindowSize);

  registry.setLocationResolver(locations);

  return {
    registry,
    availability,
    capacity,
    locations,
    calendar,
    skills,
    twins,
    maintenance,
    quality,
    registerResource(record, now) {
      registry.register(record);
      twins.initTwin(record.id, record.twin);
      availability.setState(record.id, record.health.operationalState, now);
      // Optional capacity envelope from `attributes.capacity` if present.
      const capEnvelope = (record.attributes as { capacity?: { max?: number; unit?: string } })
        .capacity;
      if (
        capEnvelope &&
        typeof capEnvelope.max === "number" &&
        typeof capEnvelope.unit === "string"
      ) {
        capacity.setCapacity(record.id, capEnvelope.max, capEnvelope.unit);
      }
    },
    registerCapability(capability) {
      registry.registerCapability(capability);
    },
  };
}
