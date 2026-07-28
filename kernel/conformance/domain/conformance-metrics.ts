/**
 * @kernel/conformance/domain/conformance-metrics — the canonical metric set
 * the SimulationEngine reports and the ConformanceEngine checksums.
 *
 * Every field is a primitive number or string — never a Date, never a
 * function. This makes the whole struct JSON-serialisable and stable across
 * machines / runtimes.
 */
export interface ConformanceMetrics {
  readonly latencyMs: number;
  readonly allocations: number;
  readonly retries: number;
  readonly failures: number;
  readonly throughput: number;
  readonly policyEvaluations: number;
  readonly compilerStages: number;
  readonly eventCount: number;
  readonly replaySuccess: boolean;
  readonly deterministicChecksum: string;
}
