/**
 * @kernel/twin-runtime/domain/twin-simulation — the TwinSimulation value object
 * + SimulationRunner PORT.
 *
 * Simulations are deterministic what-if projections of an entity's twin state
 * under a set of assumptions. They produce projected events and outcomes.
 *
 * Determinism rule: pure types — no `Date.now()`, no `Math.random()`. All
 * time flows through the `now` argument supplied by the caller; the `seed`
 * argument is the only entropy source, and is used purely as an identifier
 * (projections are fully determined by state + assumptions).
 */

import type { SimulationOutcome, Assumption } from "@kernel/shared-kernel";

/** A single projected event produced by a simulation. */
export interface SimulationProjectedEvent {
  readonly type: string;
  /** Epoch-millis from the RuntimeClock / `now` argument. */
  readonly at: number;
  readonly detail: Readonly<Record<string, unknown>>;
}

/**
 * A single what-if simulation run. `assumedState` is the starting state
 * (twin's current state overlaid with caller-supplied assumptions);
 * `projectedEvents` are the time-stamped events the simulation produced;
 * `outcomes` are the final projected metric values.
 */
export interface TwinSimulation {
  readonly id: string;
  readonly entityId: string;
  readonly scenario: string;
  readonly assumedState: Readonly<Record<string, unknown>>;
  readonly projectedEvents: readonly SimulationProjectedEvent[];
  readonly outcomes: readonly SimulationOutcome[];
  readonly assumptions: readonly Assumption[];
  /** The caller-supplied seed — used as an identifier; projections are
   *  fully determined by state + assumptions. */
  readonly seed: number;
  /** Epoch-millis from the RuntimeClock / `now` argument. */
  readonly ranAt: number;
}

/**
 * The SimulationRunner PORT. `simulate` is a pure function of
 * `(entityId, scenario, assumptions, seed, now)`; every run is appended to
 * an internal journal queried by `listSimulations`.
 */
export interface SimulationRunner {
  simulate(
    entityId: string,
    scenario: string,
    assumptions: Readonly<Record<string, unknown>>,
    seed: number,
    now: number,
  ): TwinSimulation;
  listSimulations(entityId: string): readonly TwinSimulation[];
}
