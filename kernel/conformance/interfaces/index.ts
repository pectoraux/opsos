/**
 * @kernel/conformance — public surface.
 *
 * The Kernel Conformance & Simulation Framework.
 *
 * Validates the OpsOS kernel works correctly for ANY operational business by
 * running generic, industry-neutral scenarios through a deterministic
 * simulation engine and checking the resulting events / matches / assignments
 * / decisions satisfy the declared assertions.
 *
 * Layered dependency direction:
 *   `interfaces/ → application/ → domain/`
 *   `infrastructure/ → application/ → domain/`
 *   `domain/` depends ONLY on `@kernel/shared-kernel`.
 *
 * Public surface:
 *   - Domain types:   Scenario, ScenarioInput, ScenarioOutcome,
 *                      ScenarioAssertion, FailureInjectionConfig,
 *                      ConformanceResult, ConformanceMetrics,
 *                      ExplainabilityTrace, SimulationResult,
 *                      ConformanceEngine (PORT), SimulationEngine (PORT)
 *   - Application:    RunConformance, RunSuite use-cases
 *   - Infrastructure: DefaultConformanceEngine, DefaultSimulationEngine,
 *                      DefaultExplainabilityEngine, DefaultFailureInjector,
 *                      createConformanceEngine() factory
 *   - Scenarios:      REFERENCE_SCENARIOS (25 built-in scenarios) +
 *                      per-scenario named exports
 *
 * Determinism guarantees (enforced):
 *   - NO `Date.now()` / `Math.random()` anywhere.
 *   - All time from `ScenarioInput.baseTime` + a FixedRuntimeClock.
 *   - All randomness from `SeededRandomSource(scenario.inputs.clockSeed)`.
 *   - The same Scenario ALWAYS produces the same ConformanceResult.
 *   - `replayVerified` is computed by running the simulation TWICE and
 *      comparing the deterministic checksums.
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
export * from "../scenarios";
