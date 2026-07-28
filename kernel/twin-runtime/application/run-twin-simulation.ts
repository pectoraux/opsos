/**
 * @kernel/twin-runtime/application/run-twin-simulation — use-case: run a
 * what-if simulation on a twin.
 *
 * Wraps `SimulationRunner.simulate`. The simulation is seeded and
 * deterministic: identical inputs always produce identical projected events
 * and outcomes.
 *
 * Determinism rule: identical inputs + identical runner → identical outputs.
 */

import type { TwinSimulation, SimulationRunner } from "../domain";

/** The input to `RunTwinSimulation.execute`. Pure data. */
export interface RunTwinSimulationInput {
  readonly entityId: string;
  readonly scenario: string;
  /** Caller-supplied assumption overlay — merged over the twin's current state. */
  readonly assumptions: Readonly<Record<string, unknown>>;
  /** Caller-supplied seed — used as an identifier; projections are fully
   *  determined by state + assumptions. */
  readonly seed: number;
  /** Clock-sourced epoch-millis — used as `ranAt`. */
  readonly now: number;
}

/** The use-case PORT. */
export interface RunTwinSimulation {
  execute(input: RunTwinSimulationInput): TwinSimulation;
}

/** Default implementation. Thin wrapper over the SimulationRunner port. */
export class RunTwinSimulationUseCase implements RunTwinSimulation {
  constructor(private readonly simulations: SimulationRunner) {}

  execute(input: RunTwinSimulationInput): TwinSimulation {
    return this.simulations.simulate(
      input.entityId,
      input.scenario,
      input.assumptions,
      input.seed,
      input.now,
    );
  }
}
