/**
 * @kernel/intelligence/domain/prediction — the Prediction primitive and the
 * PredictionEngine PORT.
 *
 * A Prediction is a deterministic forecast of a future operational metric
 * (execution duration, queue growth, resource utilisation, failure rate, …).
 * Intelligence NEVER performs work: a Prediction is a read-only projection of
 * likely future state, computed from historical / contextual data.
 *
 * `PredictionMetric` enumerates the forecastable metrics. The list is additive.
 *
 * The default `DefaultPredictionEngine` is a DETERMINISTIC MOCK — it uses simple
 * heuristics (moving average, linear extrapolation) and contains NO machine
 * learning. It exists so the intelligence contracts can be exercised in
 * self-test and conformance. Real ML / RL / LLM predictors implement the same
 * port and slot in later.
 *
 * `horizon` is milliseconds into the future. `confidence` ∈ [0, 1] reflects
 * data availability, not statistical rigour (the default engine's confidence is
 * a deterministic function of how much input data was supplied).
 */

/** Forecastable operational metrics. FROZEN. */
export type PredictionMetric =
  | "execution-duration"
  | "queue-growth"
  | "resource-utilization"
  | "failures"
  | "congestion"
  | "demand"
  | "quality"
  | "compliance-risk";

/**
 * Prediction — an immutable forecast. `predictedValue` is in the units implied
 * by `metric` (or `unit` when supplied). `method` is a human-readable
 * description of how the value was derived (e.g. "moving-average(n=3)").
 */
export interface Prediction {
  readonly id: string;
  readonly metric: PredictionMetric;
  readonly predictedValue: number;
  readonly unit?: string;
  readonly confidence: number;
  readonly horizon: number;
  readonly method: string;
  readonly assumptions: readonly string[];
}

/**
 * PredictionEngine — PORT. Produces a deterministic Prediction for the given
 * metric. `horizon` defaults to a sensible value per metric when omitted.
 *
 * The default implementation is heuristic-only (NO ML). AI-backed predictors
 * implement this port and supply the HOW; the kernel owns the WHAT.
 */
export interface PredictionEngine {
  predict(
    metric: PredictionMetric,
    context?: Readonly<Record<string, unknown>>,
    horizon?: number
  ): Prediction;
}
