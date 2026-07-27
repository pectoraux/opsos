/**
 * @kernel/resource-kernel/domain/location-resolver — the LocationResolver PORT.
 *
 * Owns the location hierarchy. Locations form a tree (building → floor →
 * room; region → zone → point; route → segment). The resolver answers
 * hierarchy queries the Coordination Kernel needs when matching demands with
 * location constraints:
 *
 *   - "give me all resources in building B"  → listByLocation(B) walks children
 *   - "is room R inside building B?"         → contains(B, R) walks ancestors
 *   - "what's the distance between A and B?" → distance(A, B) via a
 *                                               protocol-supplied travel model
 *
 * The kernel itself has NO opinion on what "distance" means — that's a
 * protocol concern (driving, walking, flying). The resolver exposes a
 * `TravelModel` port the protocol registers; absent one, `distance` returns
 * `undefined`.
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`.
 */

import type { LocationId } from "@kernel/shared-kernel";
import type { Location } from "@kernel/shared-kernel";

/**
 * A protocol-supplied travel model. The protocol registers one with the
 * resolver; the resolver delegates `distance(a, b)` to it. Returns `undefined`
 * when no path exists between the two locations.
 */
export interface TravelModel {
  readonly id: string;
  distance(a: LocationId, b: LocationId): number | undefined;
}

/**
 * The LocationResolver PORT.
 *
 * Implementations MUST be pure functions of `(locationId, …)`. The hierarchy
 * is read-only after registration; cycle detection is the caller's
 * responsibility (the in-memory implementation rejects cycles defensively).
 */
export interface LocationResolver {
  /** Registers a location. Re-registering the same id replaces the record. */
  register(location: Location): void;
  /** Returns the location, or `undefined` if unknown. */
  get(locationId: LocationId): Location | undefined;
  /** Returns the direct children of `parentId` (depth 1). */
  getChildren(parentId: LocationId): readonly Location[];
  /**
   * Returns the ancestor chain from `locationId`'s parent up to the root,
   * nearest-first. Returns `[]` if the location is unknown or has no parent.
   */
  getAncestors(locationId: LocationId): readonly Location[];
  /**
   * Returns `true` iff `childId` is `parentId` or `parentId` is an ancestor of
   * `childId` (transitive closure via `parentId` chain).
   */
  contains(parentId: LocationId, childId: LocationId): boolean;
  /**
   * Returns the distance between `a` and `b` via the registered travel model,
   * or `undefined` if no model is registered or no path exists.
   */
  distance(a: LocationId, b: LocationId): number | undefined;
  /**
   * Registers a travel model. Subsequent `distance` calls delegate to it.
   */
  registerTravelModel(model: TravelModel): void;
}
