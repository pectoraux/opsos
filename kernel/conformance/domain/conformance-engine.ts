/**
 * @kernel/conformance/domain/conformance-engine — the ConformanceEngine PORT.
 *
 * Runs a Scenario through the SimulationEngine, evaluates every
 * `ScenarioAssertion` predicate against the SimulationResult, computes
 * deterministic metrics, builds the ExplainabilityTrace, and verifies replay
 * (run the simulation twice with the same seed, compare checksums).
 *
 * The SAME Scenario MUST produce the SAME ConformanceResult — this is the
 * fundamental contract of the conformance framework.
 */
import type { Scenario } from "./scenario";
import type { ConformanceResult, SuiteResult } from "./conformance-result";

export interface ConformanceEngine {
  runScenario(scenario: Scenario): ConformanceResult;
  runSuite(scenarios: readonly Scenario[]): SuiteResult;
}
