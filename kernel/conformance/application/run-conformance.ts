/**
 * @kernel/conformance/application/run-conformance — the use-case that runs a
 * single Scenario through a ConformanceEngine.
 *
 * Thin orchestration layer: it delegates entirely to the engine. Provided as
 * a callable use-case so application code can compose conformance runs into
 * higher-level workflows (CI gates, deployment gates, regression suites).
 */
import type {
  ConformanceEngine,
  ConformanceResult,
  Scenario,
} from "../domain";

export class RunConformance {
  constructor(private readonly engine: ConformanceEngine) {}

  execute(scenario: Scenario): ConformanceResult {
    return this.engine.runScenario(scenario);
  }
}
