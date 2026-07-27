/**
 * @kernel/resource-kernel/infrastructure/in-memory-location-resolver — the
 * in-memory `LocationResolver` implementation.
 *
 * Pure data structures: a `Map<LocationId, Location>` plus an optional
 * registered `TravelModel`. No `Date.now()`, no `Math.random()`.
 *
 * Hierarchy walks use the `parentId` chain. Cycle detection: `getAncestors`
 * walks up to a fixed depth (default 64) to defensively abort on cycle.
 */

import type { LocationId } from "@kernel/shared-kernel";
import type { Location } from "@kernel/shared-kernel";
import type { LocationResolver, TravelModel } from "../domain";

const MAX_HIERARCHY_DEPTH = 64;

export class InMemoryLocationResolver implements LocationResolver {
  private readonly locations = new Map<LocationId, Location>();
  private travelModel: TravelModel | undefined;

  register(location: Location): void {
    this.locations.set(location.id, location);
  }

  get(locationId: LocationId): Location | undefined {
    return this.locations.get(locationId);
  }

  getChildren(parentId: LocationId): readonly Location[] {
    const out: Location[] = [];
    for (const loc of this.locations.values()) {
      if (loc.parentId === parentId) out.push(loc);
    }
    // Deterministic: sort by id.
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  getAncestors(locationId: LocationId): readonly Location[] {
    const out: Location[] = [];
    let current = this.locations.get(locationId);
    let depth = 0;
    while (current && current.parentId && depth < MAX_HIERARCHY_DEPTH) {
      const parent = this.locations.get(current.parentId);
      if (!parent) break;
      out.push(parent);
      current = parent;
      depth += 1;
    }
    return out;
  }

  contains(parentId: LocationId, childId: LocationId): boolean {
    if (parentId === childId) return true;
    const ancestors = this.getAncestors(childId);
    return ancestors.some((a) => a.id === parentId);
  }

  distance(a: LocationId, b: LocationId): number | undefined {
    if (!this.travelModel) return undefined;
    return this.travelModel.distance(a, b);
  }

  registerTravelModel(model: TravelModel): void {
    this.travelModel = model;
  }
}
