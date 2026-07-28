/**
 * @kernel/conformance/domain/conformance-result — the result of running a
 * single Scenario through the ConformanceEngine, plus the SuiteResult for a
 * full scenario suite.
 *
 * `passed` is true iff every `error`/`fatal` assertion passed and
 * `replayVerified === true`. `deterministicChecksum` is the canonical-JSON
 * hash of (events + matches + assignments + decisions + metrics) from the
 * simulation, computed via `hashSeed` from `@kernel/shared-kernel`.
 */
import type { ConformanceMetrics } from "./conformance-metrics";
import type { ExplainabilityTrace } from "./explainability";

export interface AssertionResult {
  readonly assertionId: string;
  readonly description: string;
  readonly passed: boolean;
  readonly actual: string;
  readonly expected: string;
  readonly severity: string;
}

export interface ConformanceResult {
  readonly scenarioId: string;
  readonly scenarioName: string;
  readonly passed: boolean;
  readonly assertions: readonly AssertionResult[];
  readonly metrics: ConformanceMetrics;
  readonly explainability: ExplainabilityTrace;
  readonly replayVerified: boolean;
  readonly deterministicChecksum: string;
  readonly durationMs: number;
  readonly failure?: { readonly kind: string; readonly message: string };
}

export interface SuiteResult {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly results: readonly ConformanceResult[];
  readonly deterministicChecksum: string;
  readonly durationMs: number;
}
