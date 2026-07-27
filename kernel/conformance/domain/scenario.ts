/**
 * @kernel/conformance/domain/scenario — the Scenario primitive. A complete,
 * declarative, replayable description of a kernel-behaviour test.
 *
 * A Scenario is DATA — it carries no functions. This is what makes it
 * transportable (a scenario can be exported from one OpsOS install, dropped
 * into another, and produce identical results). The `replaySeed` is the
 * canonical seed for replay verification.
 */
import type { ScenarioInput } from "./scenario-input";
import type { ScenarioOutcome } from "./scenario-outcome";
import type { ScenarioAssertion } from "./scenario-assertion";
import type { FailureInjectionConfig } from "./failure-injection";

export interface Scenario {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly inputs: ScenarioInput;
  readonly expectedOutcomes: ScenarioOutcome;
  readonly assertions: readonly ScenarioAssertion[];
  readonly replaySeed: number;
  readonly failureInjection?: FailureInjectionConfig;
}
