/**
 * @kernel/twin-runtime/infrastructure/default-prediction-engine — the default
 * deterministic `PredictionEngine`.
 *
 * Predictions are computed by simple linear extrapolation from the recent
 * telemetry history of the requested metric. No ML.
 *
 * Algorithm:
 *   1. Take the last N (≤ 16) readings for (entityId, metric) with
 *      timestamp ≤ now.
 *   2. If 0 readings: predictedValue = 0, method = "none", confidence = 0.
 *   3. If 1 reading: predictedValue = that value, method = "constant",
 *      confidence = 0.3.
 *   4. If ≥ 2 readings: least-squares linear fit → slope + intercept;
 *      predictedValue = slope * (now + horizon) + intercept; method =
 *      "linear-extrapolation"; confidence = clampUnit(
 *      (0.9 - horizon / 24h) * n / N).
 *
 * All time in epoch ms. All arithmetic deterministic. No `Date.now()`, no
 * `Math.random()`.
 */

import type {
  TwinPrediction,
  PredictionEngine,
  TwinPredictionMethod,
} from "../domain";
import type { TelemetryStream } from "../domain";
import { clampUnit } from "../domain";

const MAX_POINTS = 16;
const HORIZON_CONFIDENCE_DECAY_MS = 1000 * 60 * 60 * 24; // 24h

export class DefaultPredictionEngine implements PredictionEngine {
  private readonly byEntity = new Map<string, TwinPrediction[]>();

  constructor(private readonly telemetry: TelemetryStream) {}

  predict(entityId: string, metric: string, horizon: number, now: number): TwinPrediction {
    const readings = this.telemetry
      .getReadings(entityId, metric, undefined, now)
      .slice(-MAX_POINTS);
    const id = `pred#${entityId}#${metric}#${now}#${horizon}`;
    const computedAt = now;

    let predictedValue = 0;
    let confidence = 0;
    let method: TwinPredictionMethod = "none";

    if (readings.length === 0) {
      method = "none";
      predictedValue = 0;
      confidence = 0;
    } else if (readings.length === 1) {
      method = "constant";
      predictedValue = readings[0].value;
      confidence = 0.3;
    } else {
      // least-squares linear fit
      const n = readings.length;
      let sx = 0;
      let sy = 0;
      let sxx = 0;
      let sxy = 0;
      for (const r of readings) {
        sx += r.timestamp;
        sy += r.value;
        sxx += r.timestamp * r.timestamp;
        sxy += r.timestamp * r.value;
      }
      const denom = n * sxx - sx * sx;
      if (denom === 0) {
        // All readings share the same timestamp — fall back to the mean.
        method = "constant";
        predictedValue = sy / n;
        confidence = 0.3;
      } else {
        const slope = (n * sxy - sx * sy) / denom;
        const intercept = (sy - slope * sx) / n;
        method = "linear-extrapolation";
        predictedValue = slope * (now + horizon) + intercept;
        const horizonPenalty = horizon / HORIZON_CONFIDENCE_DECAY_MS;
        const sampleFactor = n / MAX_POINTS;
        confidence = clampUnit((0.9 - horizonPenalty) * sampleFactor);
      }
    }

    const prediction: TwinPrediction = {
      id,
      entityId,
      metric,
      predictedValue,
      confidence: clampUnit(confidence),
      horizon,
      method,
      computedAt,
      assumptions: [
        {
          name: "trend-continuation",
          description:
            "Future values continue the linear trend observed in the recent telemetry window.",
        },
      ],
    };
    const list = this.byEntity.get(entityId) ?? [];
    list.push(prediction);
    this.byEntity.set(entityId, list);
    return prediction;
  }

  listPredictions(entityId: string): readonly TwinPrediction[] {
    return this.byEntity.get(entityId) ?? [];
  }
}
