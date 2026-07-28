/**
 * @kernel/resource-kernel — public surface.
 *
 * The Resource Kernel — the universal resource management layer that the
 * Coordination Kernel queries. Every operational industry coordinates
 * resources (cleaners, vacuums, drivers, vehicles, doctors, MRI machines,
 * beds, trucks, bins, guards, drones). The Resource Kernel owns WHAT
 * resources ARE; the Coordination Kernel asks "give me resources capable of
 * X".
 *
 * The kernel REALIZES the existing `Resource`, `Capability`, `Availability`,
 * `Capacity`, and `Twin` primitives (from M1) with full behavior — state
 * machines, tracking, querying — and consumes the 5 new M7 resource
 * primitives (Location, Calendar, Certification, ResourceHealth, Telemetry).
 *
 * Layered dependency direction:
 *   `interfaces/ → application/ → domain/`
 *   `infrastructure/ → application/ → domain/`
 *   `domain/` depends ONLY on `@kernel/shared-kernel`.
 *
 * Public surface:
 *   - Ports (9):    ResourceRegistry, AvailabilityEngine, CapacityTracker,
 *                    LocationResolver, ResourceCalendar, SkillRegistry,
 *                    TwinManager, MaintenanceTracker, QualityMetrics
 *   - Application:  FindCapableResources + ReserveCapacity + UpdateTwin
 *                    use-cases (+ UseCase classes)
 *   - Infrastructure: 9 in-memory implementations +
 *                      InMemoryResourceKernel bundle +
 *                      createInMemoryResourceKernel() helper +
 *                      computeMatchScore
 *
 * Determinism guarantees (enforced):
 *   - NO `Date.now()` / `Math.random()` anywhere in this module.
 *   - All time flows through the `now` argument.
 *   - All engines are pure functions of their inputs.
 *   - `findCapable` ranking ties broken by `resourceId` lexicographic order.
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
