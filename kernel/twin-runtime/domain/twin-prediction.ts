/**
 * @kernel/twin-runtime/domain/twin-prediction — the TwinPrediction value object
 * + PredictionEngine PORT.
 *
 * Predictions are forward projections of a single metric. The default
 * implementation uses deterministic linear extrapolation from telemetry
 * history — no ML.
 *
 * Determinism rule: pure types — no `Date.now()`, no `Math.random()`. All
 * time flows through the `now` argument supplied by the caller.
 */

import type { Assumption } from "@kernel/shared-kernel";

/** How the prediction was computed. */
export type TwinPredictionMethod =
  | "linear-extrapolation"
  | "constant"
  | "none";

/**
 * A forward projection of a single metric for a single entity. `horizon` is
 * the projected duration in ms (i.e. the prediction is for time
 * `computedAt + horizon`).
 */
export interface TwinPrediction {
  readonly id: string;
  readonly entityId: string;
  readonly metric: string;
  readonly predictedValue: number;
  /** Caller/computed confidence in [0, 1]. */
  readonly confidence: number;
  /** Projected duration in ms. */
  readonly horizon: number;
  readonly method: TwinPredictionMethod;
  /** Epoch-millis from the RuntimeClock / `now` argument. */
  readonly computedAt: number;
  readonly assumptions: readonly Assumption[];
}

/**
 * The PredictionEngine PORT. `predict` is a pure function of
 * `(entityId, metric, horizon, now)`; the latest prediction per call is
 * appended to an internal journal queried by `listPredictions`.
 */
export interface PredictionEngine {
  predict(entityId: string, metric: string, horizon: number, now: number): TwinPrediction;
  listPredictions(entityId: string): readonly TwinPrediction[];
}
