/**
 * @kernel/conformance/domain/scenario-assertion — a single check the
 * ConformanceEngine runs against the SimulationResult.
 *
 * `predicate` is a `SerializableAssertionPredicate` (data, NOT a JS function)
 * — this keeps the entire scenario document replayable and transportable.
 * The ConformanceEngine interprets the predicate op via a built-in evaluator.
 *
 * `severity` controls how a failed assertion affects `ConformanceResult.passed`:
 *   - `info`  — never fails the scenario; recorded for explainability.
 *   - `warn`  — recorded; does not fail the scenario on its own.
 *   - `error` — fails the scenario if not passed.
 *   - `fatal` — fails the scenario AND short-circuits remaining assertions.
 */
export type AssertionSeverity = "info" | "warn" | "error" | "fatal";

/**
 * A data-shaped predicate. `op` selects the evaluator; `args` are its
 * parameters. Built-in ops (evaluated by DefaultConformanceEngine):
 *
 *   - `result-ok`           args: [boolean]            — sim.ok === args[0]
 *   - `event-count-eq`      args: [number]             — events.length === args[0]
 *   - `event-count-gte`     args: [number]             — events.length >= args[0]
 *   - `event-emitted`       args: [eventType: string]  — some event has eventType
 *   - `event-not-emitted`   args: [eventType: string]  — no event has eventType
 *   - `match-count-eq`      args: [number]
 *   - `match-for-resource`  args: [resourceId: string]
 *   - `no-match-for-resource` args: [resourceId: string]
 *   - `assignment-status`   args: [resourceId, status]
 *   - `assignment-count-eq` args: [number]
 *   - `decision-outcome`    args: [outcome: string]
 *   - `metric-eq`           args: [metricName, value]
 *   - `metric-gte`          args: [metricName, value]
 *   - `replay-verified`     args: [boolean]
 *   - `no-failure`          args: []
 *   - `failure-kind`        args: [kind: string]
 *   - `deterministic-checksum` args: [checksum: string]
 */
export interface SerializableAssertionPredicate {
  readonly op: string;
  readonly args: readonly unknown[];
}

export interface ScenarioAssertion {
  readonly id: string;
  readonly description: string;
  readonly predicate: SerializableAssertionPredicate;
  readonly severity: AssertionSeverity;
}
