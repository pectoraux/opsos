/**
 * @kernel/resource-kernel/domain/resource-registry — the ResourceRegistry PORT.
 *
 * THE port the Coordination Kernel queries. Every operational industry
 * coordinates resources (cleaners, vacuums, drivers, vehicles, doctors, MRI
 * machines, beds, trucks, bins, guards, drones). The Resource Kernel owns
 * WHAT resources ARE; the Coordination Kernel asks "give me resources
 * capable of X".
 *
 * The registry is the SOLE source of truth for the canonical `ResourceRecord`
 * (the M7 realized resource — `Resource` primitive enriched with location,
 * calendar, certifications, health, twin, cost model, quality metrics).
 *
 * The key method is `findCapable`: given a `FindCapableRequest`
 * (capabilityType, quantity, window, constraints, now) and the three sibling
 * engines (availability, capacity, skills), it returns a ranked list of
 * `CapableResource` candidates. This is the spine of the Resource Kernel —
 * every coordination query routes through here.
 *
 * Ranking (deterministic, multi-key):
 *   1. available         — `true` first
 *   2. certified         — `true` first
 *   3. remainingCapacity — descending
 *   4. confidence        — descending
 *   5. resourceId        — lexicographic ascending (the determinism anchor)
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`. All
 * time flows through the `now` argument in the request.
 */

import type {
  ResourceId,
  CapabilityId,
  LocationId,
  TenantId,
} from "@kernel/shared-kernel";
import type {
  ResourceRecord,
  Capability,
  Quantity,
  Constraint,
} from "@kernel/shared-kernel";
import type { TemporalWindow } from "@kernel/shared-kernel";
import type { AvailabilityEngine } from "./availability-engine";
import type { CapacityTracker } from "./capacity-tracker";
import type { SkillRegistry } from "./skill-registry";
import type { AvailabilityState } from "./availability-engine";

/**
 * A request to find capable resources. Pure data.
 *
 *   `capabilityType` — the capability-type string the demand requires
 *                      (e.g. "cleaning.deep-clean", "transport.refrigerated",
 *                       "medical.mri-scan").
 *   `quantity`       — how much capacity the demand requires.
 *   `window`         — the temporal window the demand must be served in.
 *   `constraints`    — protocol-supplied constraints (the kernel only
 *                      interprets the generic kinds; protocol-specific kinds
 *                      default to satisfied).
 *   `now`            — clock-sourced epoch-millis, supplied by the caller.
 */
export interface FindCapableRequest {
  readonly capabilityType: string;
  readonly quantity: Quantity;
  readonly window: TemporalWindow;
  readonly constraints: readonly Constraint[];
  readonly now: number;
}

/**
 * A single ranked candidate resource returned by `findCapable`.
 *
 *   `resource`           — the canonical `ResourceRecord`.
 *   `matchScore`         — numeric score encoding the ranking priority (higher
 *                          is better). Computed deterministically from
 *                          (available, certified, remainingCapacity,
 *                          confidence); resourceId is the final tiebreak
 *                          (applied externally to the sort, NOT encoded in
 *                          matchScore).
 *   `available`          — whether the resource is in an accepting state.
 *   `remainingCapacity`  — current remaining capacity (max − currentLoad).
 *                          `0` if the resource has no capacity tracked.
 *   `certified`          — whether the resource holds an active certification
 *                          for `capabilityType` at level ≥ 0.
 *   `confidence`         — the kernel's confidence in the resource for
 *                          `capabilityType` (max across active certs), in
 *                          `[0, 1]`. `0` if not certified.
 */
export interface CapableResource {
  readonly resource: ResourceRecord;
  readonly matchScore: number;
  readonly available: boolean;
  readonly remainingCapacity: number;
  readonly certified: boolean;
  readonly confidence: number;
}

/**
 * The ResourceRegistry PORT.
 *
 * Implementations MUST be pure functions of `(resourceId, …)`. The registry
 * holds the canonical map `ResourceId → ResourceRecord`; the sibling engines
 * (availability, capacity, skills, calendar, twin, maintenance, quality) hold
 * the behavioural state.
 */
export interface ResourceRegistry {
  /** Registers (or replaces) a resource record. */
  register(record: ResourceRecord): void;
  /** Unregisters a resource record. */
  unregister(resourceId: ResourceId): void;
  /** Returns the resource record, or `undefined` if unknown. */
  get(resourceId: ResourceId): ResourceRecord | undefined;
  /** Returns all registered resources (insertion order). */
  list(): readonly ResourceRecord[];
  /**
   * Returns all resources that have at least one capability of the given type.
   * Uses the capability map populated via `registerCapability`.
   */
  listByCapability(capabilityType: string): readonly ResourceRecord[];
  /**
   * Returns all resources whose location is `locationId` OR whose location is
   * a descendant of `locationId` (hierarchy walk via the sibling
   * LocationResolver, if supplied). When no LocationResolver is wired, only
   * exact location matches are returned.
   */
  listByLocation(locationId: LocationId): readonly ResourceRecord[];
  /**
   * Returns all resources currently in the given availability state. When
   * `window` is supplied, also gates by `availability.isAvailable(window)`.
   */
  listByAvailability(
    state: AvailabilityState,
    window?: TemporalWindow
  ): readonly ResourceRecord[];
  /**
   * Registers (or replaces) a `Capability` record. The resource that owns the
   * capability (via `ResourceRecord.capabilities`) becomes discoverable by
   * the capability's `capabilityType`.
   */
  registerCapability(capability: Capability): void;
  /** Returns a registered capability by id, or `undefined` if unknown. */
  getCapability(capabilityId: CapabilityId): Capability | undefined;
  /**
   * THE key query. Returns a ranked list of `CapableResource` candidates for
   * the given request. See `CapableResource` for the ranking rules.
   *
   * The sibling engines (availability, capacity, skills) are passed in so the
   * registry stays a thin lookup layer — behavioural state lives in the
   * engines, not the registry.
   */
  findCapable(
    request: FindCapableRequest,
    availability: AvailabilityEngine,
    capacity: CapacityTracker,
    skills: SkillRegistry
  ): readonly CapableResource[];
}

// ── Scoring constants ─────────────────────────────────────────────────────

/**
 * Weight contributed to `matchScore` when a resource is available.
 * Dominates all other weights (available always ranks above unavailable).
 */
export const AVAILABLE_WEIGHT = 1_000_000_000;

/**
 * Weight contributed to `matchScore` when a resource is certified for the
 * requested capability type. Dominates capacity/confidence but is dominated
 * by availability.
 */
export const CERTIFIED_WEIGHT = 1_000_000;

/**
 * Multiplier applied to `remainingCapacity` when computing `matchScore`.
 * Remaining capacity is bounded by `Math.min(remaining, 999_999)` so it can
 * never collide with the certified weight.
 */
export const REMAINING_CAPACITY_WEIGHT = 1;

/**
 * Multiplier applied to `confidence` when computing `matchScore`. Confidence
 * is in `[0, 1]`, so this scales it to `[0, 1_000)` — subordinate to capacity
 * but a useful tiebreaker.
 */
export const CONFIDENCE_WEIGHT = 1_000;
