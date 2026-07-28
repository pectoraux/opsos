/**
 * @kernel/twin-runtime/application — barrel.
 *
 * The application layer of the Twin Runtime. Use-cases that orchestrate the
 * domain ports. Depends on `domain/` and `@kernel/shared-kernel` only.
 *
 * Public surface:
 *   - UpdateTwinState use-case + UpdateTwinStateUseCase class +
 *     UpdateTwinStateInput / UpdateTwinStateResult
 *   - IngestTelemetry use-case + IngestTelemetryUseCase class +
 *     IngestTelemetryInput / IngestTelemetryResult
 *   - GetTwinOverview use-case + GetTwinOverviewUseCase class + TwinOverview
 *   - RunTwinSimulation use-case + RunTwinSimulationUseCase class +
 *     RunTwinSimulationInput
 */

export type {
  UpdateTwinStateInput,
  UpdateTwinStateResult,
  UpdateTwinState,
} from "./update-twin-state";
export { UpdateTwinStateUseCase } from "./update-twin-state";

export type {
  IngestTelemetryInput,
  IngestTelemetryResult,
  IngestTelemetry,
} from "./ingest-telemetry";
export { IngestTelemetryUseCase } from "./ingest-telemetry";

export type {
  TwinOverview,
  GetTwinOverview,
} from "./get-twin-overview";
export { GetTwinOverviewUseCase } from "./get-twin-overview";

export type {
  RunTwinSimulationInput,
  RunTwinSimulation,
} from "./run-twin-simulation";
export { RunTwinSimulationUseCase } from "./run-twin-simulation";
