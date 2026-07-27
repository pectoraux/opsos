/**
 * @kernel/resource-kernel/application/find-capable-resources — the spine
 * use-case of the Resource Kernel.
 *
 * Given (capabilityType, quantity, window, constraints, now), query the
 * ResourceRegistry + AvailabilityEngine + CapacityTracker + SkillRegistry and
 * return ranked candidates. This is THE method the Coordination Kernel calls
 * when it asks "give me resources capable of X".
 *
 * The use-case is a thin orchestration layer: it delegates to
 * `registry.findCapable(request, availability, capacity, skills)` — the
 * ranking logic lives in the registry (so it can be tested / replaced
 * independently). The use-case exists to give the Coordination Kernel a
 * single typed entry point and to allow protocols to swap in alternative
 * ranking policies by injecting a different registry.
 *
 * Determinism rule: identical inputs + identical engine implementations →
 * identical outputs. No `Date.now()`, no `Math.random()`.
 */

import type { ResourceId } from "@kernel/shared-kernel";
import type {
  ResourceRegistry,
  AvailabilityEngine,
  CapacityTracker,
  SkillRegistry,
  FindCapableRequest,
  CapableResource,
} from "../domain";

/**
 * Optional filters a caller may apply on top of the bare `FindCapableRequest`.
 * When supplied, the use-case filters the registry's results to those whose
 * `resource.id` is in `includeResourceIds` (when present) AND not in
 * `excludeResourceIds` (when present). This is the protocol's escape hatch
 * for "I already tried R1 and R2, don't suggest them again".
 */
export interface FindCapableFilters {
  readonly includeResourceIds?: readonly ResourceId[];
  readonly excludeResourceIds?: readonly ResourceId[];
  /** Cap the number of returned candidates. Default: unlimited. */
  readonly limit?: number;
}

/**
 * The full input to `FindCapableResources.execute`. Pure data.
 */
export interface FindCapableResourcesInput {
  readonly request: FindCapableRequest;
  readonly filters?: FindCapableFilters;
}

/**
 * The use-case PORT.
 */
export interface FindCapableResources {
  execute(input: FindCapableResourcesInput): readonly CapableResource[];
}

/**
 * Default implementation. Constructed with the four engines (typically the
 * in-memory implementations from `infrastructure/`).
 */
export class FindCapableResourcesUseCase implements FindCapableResources {
  constructor(
    private readonly registry: ResourceRegistry,
    private readonly availability: AvailabilityEngine,
    private readonly capacity: CapacityTracker,
    private readonly skills: SkillRegistry
  ) {}

  execute(input: FindCapableResourcesInput): readonly CapableResource[] {
    const ranked = this.registry.findCapable(
      input.request,
      this.availability,
      this.capacity,
      this.skills
    );

    const filters = input.filters;
    if (!filters) return ranked;

    const includeSet = filters.includeResourceIds
      ? new Set(filters.includeResourceIds)
      : undefined;
    const excludeSet = filters.excludeResourceIds
      ? new Set(filters.excludeResourceIds)
      : undefined;

    const filtered = ranked.filter((c) => {
      const id = c.resource.id;
      if (includeSet && !includeSet.has(id)) return false;
      if (excludeSet && excludeSet.has(id)) return false;
      return true;
    });

    if (typeof filters.limit === "number" && filters.limit >= 0) {
      return filtered.slice(0, filters.limit);
    }
    return filtered;
  }
}
