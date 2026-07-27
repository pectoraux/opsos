/**
 * @kernel/intelligence/application/detect-anomalies — use-case that detects
 * anomalies in operational data.
 *
 * Thin orchestrator: delegates to the injected `AnomalyDetector`. The returned
 * anomalies are read-only observations — intelligence never performs work.
 * Operators (or external automations) act on them through the kernel's command
 * side.
 *
 * Deterministic given identical engine + input.
 */
import type { Anomaly, AnomalyDetector } from "../domain";

/** Input to `detectAnomalies`. */
export interface DetectAnomaliesInput {
  readonly context?: Readonly<Record<string, unknown>>;
}

/** Deps — the engine that detects anomalies. */
export interface DetectAnomaliesDeps {
  readonly engine: AnomalyDetector;
}

/** `detectAnomalies` — produces a list of detected anomalies. */
export function detectAnomalies(
  input: DetectAnomaliesInput,
  deps: DetectAnomaliesDeps
): readonly Anomaly[] {
  return deps.engine.detect(input.context);
}

/** `DetectAnomalies` — class form of the use-case. */
export class DetectAnomalies {
  constructor(private readonly deps: DetectAnomaliesDeps) {}

  execute(input: DetectAnomaliesInput): readonly Anomaly[] {
    return detectAnomalies(input, this.deps);
  }
}
