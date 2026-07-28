/**
 * @kernel/twin-runtime — public surface.
 *
 * The Digital Twin Runtime — the universal runtime that gives every OpsOS
 * entity a digital twin with current state, historical state, predicted
 * state, simulated state, live telemetry, health, and recommendations.
 * Cleaning, mobility, healthcare, and manufacturing all use exactly the
 * same twin runtime.
 *
 * Layered dependency direction:
 *   `interfaces/ → application/ → domain/`
 *   `infrastructure/ → application/ → domain/`
 *   `domain/` depends ONLY on `@kernel/shared-kernel`.
 *
 * Public surface:
 *   - Domain (8 files): twin-state, twin-history, twin-telemetry, twin-health,
 *     twin-prediction, twin-simulation, twin-recommendation, twin-registry
 *   - Application (4 use-cases): update-twin-state, ingest-telemetry,
 *     get-twin-overview, run-twin-simulation
 *   - Infrastructure (7 in-memory/default impls) + TwinRuntime bundle +
 *     createTwinRuntime() helper
 *
 * Determinism guarantees (enforced):
 *   - NO `Date.now()` / `Math.random()` anywhere in this module.
 *   - All time flows through the `now` argument.
 *   - All predictions/simulations are deterministic (linear extrapolation,
 *     seeded projections, rule-based health & recommendations).
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
