/**
 * @kernel/conformance/application/run-suite — the use-case that runs a full
 * suite of Scenarios through a ConformanceEngine and returns the aggregated
 * SuiteResult.
 *
 * Thin orchestration: delegates to `engine.runSuite`. Exposed as a use-case
 * so callers can inject their own engine (e.g. a recording wrapper) without
 * changing call sites.
 */
import type { ConformanceEngine, Scenario, SuiteResult } from "../domain";

export class RunSuite {
  constructor(private readonly engine: ConformanceEngine) {}

  execute(scenarios: readonly Scenario[]): SuiteResult {
    return this.engine.runSuite(scenarios);
  }
}
