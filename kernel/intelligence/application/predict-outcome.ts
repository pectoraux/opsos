/**
 * @kernel/intelligence/application/predict-outcome — use-case that produces a
 * deterministic Prediction for a future operational metric.
 *
 * Thin orchestrator: delegates to the injected `PredictionEngine`. The default
 * engine is a deterministic mock (NO ML); AI-backed predictors slot in via the
 * same port.
 *
 * Intelligence NEVER performs work — a Prediction is a read-only forecast.
 * Deterministic given identical engine + input + horizon.
 */
import type { Prediction, PredictionEngine, PredictionMetric } from "../domain";

/** Input to `predictOutcome`. */
export interface PredictOutcomeInput {
  readonly metric: PredictionMetric;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly horizon?: number;
}

/** Deps — the engine that produces the prediction. */
export interface PredictOutcomeDeps {
  readonly engine: PredictionEngine;
}

/** `predictOutcome` — produces a Prediction. */
export function predictOutcome(
  input: PredictOutcomeInput,
  deps: PredictOutcomeDeps
): Prediction {
  return deps.engine.predict(input.metric, input.context, input.horizon);
}

/** `PredictOutcome` — class form of the use-case. */
export class PredictOutcome {
  constructor(private readonly deps: PredictOutcomeDeps) {}

  execute(input: PredictOutcomeInput): Prediction {
    return predictOutcome(input, this.deps);
  }
}
