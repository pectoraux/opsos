/**
 * @kernel/twin-runtime/application/ingest-telemetry — use-case: ingest a
 * telemetry reading + re-evaluate health + regenerate recommendations.
 *
 * Wraps `TelemetryStream.ingest` + `HealthMonitor.evaluate` +
 * `RecommendationGenerator.generate`. After ingestion, the latest window of
 * telemetry is fed to the HealthMonitor to produce a fresh `TwinHealth`;
 * recommendations are then regenerated from the new health + the entity's
 * existing predictions.
 *
 * Determinism rule: identical inputs + identical ports → identical outputs.
 */

import type {
  TelemetryReading,
  TelemetryStream,
  HealthMonitor,
  TwinHealth,
  RecommendationGenerator,
  PredictionEngine,
  TwinRecommendation,
} from "../domain";

/** The input to `IngestTelemetry.execute`. Pure data. */
export interface IngestTelemetryInput {
  readonly reading: TelemetryReading;
  /** Optional evaluation window (ms back from `now`). Defaults to all telemetry. */
  readonly windowMs?: number;
  /** Clock-sourced epoch-millis — used as `lastEvaluatedAt` / `generatedAt`. */
  readonly now: number;
}

/** The result of `IngestTelemetry.execute`. */
export interface IngestTelemetryResult {
  readonly health: TwinHealth;
  readonly recommendations: readonly TwinRecommendation[];
}

/** The use-case PORT. */
export interface IngestTelemetry {
  execute(input: IngestTelemetryInput): IngestTelemetryResult;
}

/** Default implementation. */
export class IngestTelemetryUseCase implements IngestTelemetry {
  constructor(
    private readonly telemetry: TelemetryStream,
    private readonly health: HealthMonitor,
    private readonly predictions: PredictionEngine,
    private readonly recommendations: RecommendationGenerator,
  ) {}

  execute(input: IngestTelemetryInput): IngestTelemetryResult {
    this.telemetry.ingest(input.reading);
    const entityId = input.reading.entityId;
    const from = input.windowMs !== undefined ? input.now - input.windowMs : undefined;
    const readings = this.telemetry.getReadings(entityId, undefined, from, input.now);
    const health = this.health.evaluate(entityId, readings, input.now);
    const preds = this.predictions.listPredictions(entityId);
    const recs = this.recommendations.generate(entityId, health, preds, input.now);
    return { health, recommendations: recs };
  }
}
