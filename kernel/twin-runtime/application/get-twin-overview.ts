/**
 * @kernel/twin-runtime/application/get-twin-overview — use-case: get the full
 * twin overview (state + history + telemetry + health + predictions +
 * recommendations + simulations).
 *
 * A read-only aggregation use-case. Pulls every facet of a twin from the
 * underlying ports and assembles a single `TwinOverview` value.
 *
 * Determinism rule: identical inputs + identical ports → identical outputs.
 */

import type {
  TwinState,
  TwinSnapshot,
  TelemetryReading,
  TwinHealth,
  TwinPrediction,
  TwinRecommendation,
  TwinSimulation,
  TwinRegistry,
  HistoryStore,
  TelemetryStream,
  HealthMonitor,
  PredictionEngine,
  RecommendationGenerator,
  SimulationRunner,
} from "../domain";

/** The full twin overview — every facet assembled in one value. */
export interface TwinOverview {
  readonly state: TwinState | undefined;
  readonly history: readonly TwinSnapshot[];
  readonly telemetry: readonly TelemetryReading[];
  readonly health: TwinHealth | undefined;
  readonly predictions: readonly TwinPrediction[];
  readonly recommendations: readonly TwinRecommendation[];
  readonly simulations: readonly TwinSimulation[];
}

/** The use-case PORT. `from` / `to` bound the history + telemetry window. */
export interface GetTwinOverview {
  execute(entityId: string, from: number, to: number): TwinOverview;
}

/** Default implementation. */
export class GetTwinOverviewUseCase implements GetTwinOverview {
  constructor(
    private readonly registry: TwinRegistry,
    private readonly history: HistoryStore,
    private readonly telemetry: TelemetryStream,
    private readonly health: HealthMonitor,
    private readonly predictions: PredictionEngine,
    private readonly recommendations: RecommendationGenerator,
    private readonly simulations: SimulationRunner,
  ) {}

  execute(entityId: string, from: number, to: number): TwinOverview {
    return {
      state: this.registry.get(entityId),
      history: this.history.getHistory(entityId, from, to),
      telemetry: this.telemetry.getReadings(entityId, undefined, from, to),
      health: this.health.getHealth(entityId),
      predictions: this.predictions.listPredictions(entityId),
      recommendations: this.recommendations.listRecommendations(entityId),
      simulations: this.simulations.listSimulations(entityId),
    };
  }
}
