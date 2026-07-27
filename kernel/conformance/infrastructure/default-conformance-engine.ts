/**
 * @kernel/conformance/infrastructure/default-conformance-engine — the default
 * `ConformanceEngine` implementation.
 *
 * Orchestrates: simulation → assertion evaluation → metrics → explainability
 * → replay verification. Deterministic: the same Scenario produces the same
 * ConformanceResult.
 *
 * Replay verification: runs `simulate()` TWICE with the same scenario and
 * compares the deterministic checksums. If they match, `replayVerified = true`.
 *
 * Assertion evaluation: interprets each `SerializableAssertionPredicate`
 * against the first SimulationResult. `passed` is true iff every `error`/
 * `fatal` assertion passed AND `replayVerified === true`.
 *
 * `deterministicChecksum` is the simulation's checksum (computed by
 * `DefaultSimulationEngine.computeDeterministicChecksum`). The suite checksum
 * is the `hashSeed` of the joined scenario checksums.
 */
import { hashSeed } from "@kernel/shared-kernel";
import type {
  AssertionResult,
  ConformanceEngine,
  ConformanceMetrics,
  ConformanceResult,
  Scenario,
  ScenarioAssertion,
  SimulationResult,
  SuiteResult,
} from "../domain";
import type { ExplainabilityEngine } from "./default-explainability-engine";
import { DefaultExplainabilityEngine } from "./default-explainability-engine";
import type { SimulationEngine } from "../domain";
import { DefaultSimulationEngine } from "./default-simulation-engine";

export class DefaultConformanceEngine implements ConformanceEngine {
  private readonly simulation: SimulationEngine;
  private readonly explainability: ExplainabilityEngine;

  constructor(simulation?: SimulationEngine, explainability?: ExplainabilityEngine) {
    this.simulation = simulation ?? new DefaultSimulationEngine();
    this.explainability = explainability ?? new DefaultExplainabilityEngine();
  }

  runScenario(scenario: Scenario): ConformanceResult {
    // ── 1. Run the simulation TWICE for replay verification ───────────
    const first = this.simulation.simulate(scenario);
    const second = this.simulation.simulate(scenario);
    const replayVerified =
      first.metrics.deterministicChecksum === second.metrics.deterministicChecksum;

    const replay = {
      firstChecksum: first.metrics.deterministicChecksum,
      secondChecksum: second.metrics.deterministicChecksum,
      verified: replayVerified,
      note: replayVerified
        ? "Replay verified — two runs produced identical checksums."
        : "Replay MISMATCH — two runs produced different checksums.",
    };

    // ── 2. Evaluate assertions against the first simulation result ────
    const assertionResults: AssertionResult[] = scenario.assertions.map((a) =>
      this.evaluateAssertion(a, first, replayVerified)
    );

    // ── 3. Determine pass/fail ────────────────────────────────────────
    const hasFatalFailure = assertionResults.some(
      (r) => !r.passed && (r.severity === "error" || r.severity === "fatal")
    );
    const passed = !hasFatalFailure && replayVerified;

    // ── 4. Build the explainability trace ─────────────────────────────
    const trace = this.explainability.buildTrace(scenario, first, replay);

    // ── 5. Compute duration (deterministic: simulated latency) ────────
    const durationMs = first.metrics.latencyMs;

    // ── 6. Assemble the final ConformanceResult ───────────────────────
    const metrics: ConformanceMetrics = first.metrics;

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      passed,
      assertions: assertionResults,
      metrics,
      explainability: trace,
      replayVerified,
      deterministicChecksum: first.metrics.deterministicChecksum,
      durationMs,
      failure: first.failure,
    };
  }

  runSuite(scenarios: readonly Scenario[]): SuiteResult {
    const results: ConformanceResult[] = scenarios.map((s) => this.runScenario(s));
    const passed = results.filter((r) => r.passed).length;
    const failed = results.length - passed;
    const suiteChecksum = hashSeed(
      results.map((r) => r.deterministicChecksum).join("|")
    ).toString(16).padStart(8, "0");
    const durationMs = results.reduce((sum, r) => sum + r.durationMs, 0);
    return {
      total: results.length,
      passed,
      failed,
      results,
      deterministicChecksum: suiteChecksum,
      durationMs,
    };
  }

  // ── Assertion evaluation ───────────────────────────────────────────────

  private evaluateAssertion(
    assertion: ScenarioAssertion,
    sim: SimulationResult,
    replayVerified: boolean
  ): AssertionResult {
    const { op, args } = assertion.predicate;
    let passed: boolean;
    let actual: string;
    const expected = `${op}(${args.map((a) => JSON.stringify(a)).join(", ")})`;

    switch (op) {
      case "result-ok": {
        const want = args[0] === true;
        passed = sim.ok === want;
        actual = `ok=${sim.ok}`;
        break;
      }
      case "status-eq": {
        const want = String(args[0]);
        passed = sim.status === want;
        actual = `status=${sim.status}`;
        break;
      }
      case "event-count-eq": {
        const want = Number(args[0]);
        passed = sim.events.length === want;
        actual = `events.length=${sim.events.length}`;
        break;
      }
      case "event-count-gte": {
        const want = Number(args[0]);
        passed = sim.events.length >= want;
        actual = `events.length=${sim.events.length}`;
        break;
      }
      case "event-emitted": {
        const want = String(args[0]);
        const found = sim.events.some((e) => e.eventType === want);
        passed = found;
        actual = `eventTypes=[${sim.events.map((e) => e.eventType).join(",")}]`;
        break;
      }
      case "event-not-emitted": {
        const want = String(args[0]);
        const found = sim.events.some((e) => e.eventType === want);
        passed = !found;
        actual = `eventTypes=[${sim.events.map((e) => e.eventType).join(",")}]`;
        break;
      }
      case "match-count-eq": {
        const want = Number(args[0]);
        passed = sim.matches.length === want;
        actual = `matches.length=${sim.matches.length}`;
        break;
      }
      case "match-for-resource": {
        const want = String(args[0]);
        const found = sim.matches.some((m) => m.resourceId === want);
        passed = found;
        actual = `matchResources=[${sim.matches.map((m) => m.resourceId).join(",")}]`;
        break;
      }
      case "no-match-for-resource": {
        const want = String(args[0]);
        const found = sim.matches.some((m) => m.resourceId === want);
        passed = !found;
        actual = `matchResources=[${sim.matches.map((m) => m.resourceId).join(",")}]`;
        break;
      }
      case "assignment-status": {
        const wantResource = String(args[0]);
        const wantStatus = String(args[1]);
        const a = sim.assignments.find((x) => x.resourceId === wantResource);
        passed = a !== undefined && a.status === wantStatus;
        actual =
          a === undefined
            ? `no assignment for ${wantResource}`
            : `assignment(${wantResource}).status=${a.status}`;
        break;
      }
      case "assignment-count-eq": {
        const want = Number(args[0]);
        passed = sim.assignments.length === want;
        actual = `assignments.length=${sim.assignments.length}`;
        break;
      }
      case "decision-outcome": {
        const want = String(args[0]);
        const found = sim.decisions.some((d) => d.outcome === want);
        passed = found;
        actual = `decisionOutcomes=[${sim.decisions.map((d) => d.outcome).join(",")}]`;
        break;
      }
      case "metric-eq": {
        const name = String(args[0]);
        const want = Number(args[1]);
        const got = this.readMetric(sim, name);
        passed = got === want;
        actual = `${name}=${got}`;
        break;
      }
      case "metric-gte": {
        const name = String(args[0]);
        const want = Number(args[1]);
        const got = this.readMetric(sim, name);
        passed = got >= want;
        actual = `${name}=${got}`;
        break;
      }
      case "replay-verified": {
        const want = args[0] === true;
        passed = replayVerified === want;
        actual = `replayVerified=${replayVerified}`;
        break;
      }
      case "no-failure": {
        passed = sim.failure === undefined;
        actual = sim.failure === undefined ? "no failure" : `failure=${sim.failure.kind}`;
        break;
      }
      case "failure-kind": {
        const want = String(args[0]);
        passed = sim.failure !== undefined && sim.failure.kind === want;
        actual =
          sim.failure === undefined ? "no failure" : `failure.kind=${sim.failure.kind}`;
        break;
      }
      case "deterministic-checksum": {
        const want = String(args[0]);
        passed = sim.metrics.deterministicChecksum === want;
        actual = `checksum=${sim.metrics.deterministicChecksum}`;
        break;
      }
      default: {
        // Unknown op — fail loudly (severity will be respected by runScenario).
        passed = false;
        actual = `unknown-op:${op}`;
        break;
      }
    }

    return {
      assertionId: assertion.id,
      description: assertion.description,
      passed,
      actual,
      expected,
      severity: assertion.severity,
    };
  }

  private readMetric(sim: SimulationResult, name: string): number {
    const m = sim.metrics as unknown as Record<string, unknown>;
    const v = m[name];
    return typeof v === "number" ? v : Number(v) || 0;
  }
}

/**
 * Convenience factory: builds a fully-wired default conformance engine with
 * a DefaultSimulationEngine + DefaultExplainabilityEngine + DefaultFailureInjector.
 */
export function createConformanceEngine(): DefaultConformanceEngine {
  return new DefaultConformanceEngine();
}
