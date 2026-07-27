/**
 * @kernel/conformance/domain/scenario-outcome — the expected high-level
 * outcome of a simulation. The ConformanceEngine compares the actual
 * SimulationResult against these expectations.
 *
 * `expectedStatus`:
 *   - `ok`    — the simulated pipeline completed and produced matches/assignments.
 *   - `fail`  — the pipeline completed but yielded no useful match/assignment.
 *   - `abort` — the pipeline aborted early (policy denial, compiler failure, etc).
 *
 * The optional numeric/shape fields let a scenario pin the *shape* of the
 * result without coupling to internal engine bookkeeping. The checksum is
 * the strongest check: two runs of the same scenario MUST yield the same
 * `expectedDeterministicChecksum`.
 */
export type ExpectedStatus = "ok" | "fail" | "abort";

export interface ScenarioOutcome {
  readonly expectedStatus: ExpectedStatus;
  readonly expectedEventCount?: number;
  readonly expectedAssignmentCount?: number;
  readonly expectedMatchCount?: number;
  /** If provided, the scenario asserts the simulation checksum equals this. */
  readonly expectedDeterministicChecksum?: string;
  /** If provided, the scenario asserts the failure kind (if any) equals this. */
  readonly expectedFailureKind?: string;
}
