/**
 * @kernel/twin-runtime/infrastructure — barrel.
 *
 * The infrastructure layer of the Twin Runtime. Concrete in-memory
 * implementations of every port + the `createTwinRuntime()` bundle helper.
 * Pure data structures; no `Date.now()`, no `Math.random()`. Suitable for
 * tests, deterministic replay, and as reference implementations for protocol
 * authors.
 *
 * Public surface:
 *   - InMemoryTwinRegistry
 *   - InMemoryHistoryStore
 *   - InMemoryTelemetryStream
 *   - DefaultHealthMonitor
 *   - DefaultPredictionEngine
 *   - DefaultSimulationRunner
 *   - DefaultRecommendationGenerator
 *   - TwinRuntime (bundle interface)
 *   - createTwinRuntime() (bundle helper)
 */

import { InMemoryTwinRegistry } from "./in-memory-twin-registry";
import { InMemoryHistoryStore } from "./in-memory-history-store";
import { InMemoryTelemetryStream } from "./in-memory-telemetry-stream";
import { DefaultHealthMonitor } from "./default-health-monitor";
import { DefaultPredictionEngine } from "./default-prediction-engine";
import { DefaultSimulationRunner } from "./default-simulation-runner";
import { DefaultRecommendationGenerator } from "./default-recommendation-generator";

import { UpdateTwinStateUseCase } from "../application/update-twin-state";
import { IngestTelemetryUseCase } from "../application/ingest-telemetry";
import { GetTwinOverviewUseCase } from "../application/get-twin-overview";
import { RunTwinSimulationUseCase } from "../application/run-twin-simulation";

export { InMemoryTwinRegistry } from "./in-memory-twin-registry";
export { InMemoryHistoryStore } from "./in-memory-history-store";
export { InMemoryTelemetryStream } from "./in-memory-telemetry-stream";
export { DefaultHealthMonitor } from "./default-health-monitor";
export { DefaultPredictionEngine } from "./default-prediction-engine";
export { DefaultSimulationRunner } from "./default-simulation-runner";
export { DefaultRecommendationGenerator } from "./default-recommendation-generator";

/**
 * A convenience bundle of every twin-runtime component + the wired use-cases.
 * Construct one per twin-runtime session and pass the components individually
 * (or as a bundle) to higher-level services.
 *
 * The bundle wires internal cross-references:
 *   - `predictions` reads from `telemetry` (linear extrapolation input)
 *   - `simulations` reads from `registry` (twin's current state)
 *   - `recommendations` reads from `telemetry` (latest reading per metric)
 *   - `updateTwinState` writes through `registry` + `history` and reads
 *     `telemetry` + `health` to assemble the snapshot
 *   - `ingestTelemetry` writes through `telemetry` + `health` and reads
 *     `predictions` + `recommendations` to refresh downstream facets
 */
export interface TwinRuntime {
  readonly registry: InMemoryTwinRegistry;
  readonly history: InMemoryHistoryStore;
  readonly telemetry: InMemoryTelemetryStream;
  readonly health: DefaultHealthMonitor;
  readonly predictions: DefaultPredictionEngine;
  readonly simulations: DefaultSimulationRunner;
  readonly recommendations: DefaultRecommendationGenerator;

  readonly updateTwinState: UpdateTwinStateUseCase;
  readonly ingestTelemetry: IngestTelemetryUseCase;
  readonly getTwinOverview: GetTwinOverviewUseCase;
  readonly runTwinSimulation: RunTwinSimulationUseCase;
}

/**
 * Construct a fresh bundle of in-memory twin-runtime components. Each
 * component is a new instance with empty state. Cross-references between
 * components are wired (predictions ← telemetry, simulations ← registry,
 * recommendations ← telemetry).
 */
export function createTwinRuntime(): TwinRuntime {
  const registry = new InMemoryTwinRegistry();
  const history = new InMemoryHistoryStore();
  const telemetry = new InMemoryTelemetryStream();
  const health = new DefaultHealthMonitor();
  const predictions = new DefaultPredictionEngine(telemetry);
  const simulations = new DefaultSimulationRunner(registry);
  const recommendations = new DefaultRecommendationGenerator(telemetry);

  const updateTwinState = new UpdateTwinStateUseCase(
    registry,
    history,
    telemetry,
    health,
  );
  const ingestTelemetry = new IngestTelemetryUseCase(
    telemetry,
    health,
    predictions,
    recommendations,
  );
  const getTwinOverview = new GetTwinOverviewUseCase(
    registry,
    history,
    telemetry,
    health,
    predictions,
    recommendations,
    simulations,
  );
  const runTwinSimulation = new RunTwinSimulationUseCase(simulations);

  return {
    registry,
    history,
    telemetry,
    health,
    predictions,
    simulations,
    recommendations,
    updateTwinState,
    ingestTelemetry,
    getTwinOverview,
    runTwinSimulation,
  };
}
