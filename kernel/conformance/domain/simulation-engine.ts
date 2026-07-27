/**
 * @kernel/conformance/domain/simulation-engine — the SimulationEngine PORT.
 *
 * The SimulationEngine simulates the full kernel pipeline
 * (compile → coordinate → resource → knowledge → runtime) using GENERIC data
 * shapes — it does NOT call the real kernel engines. It produces output with
 * the SAME CONTRACTS (event-envelope-shaped, match-shaped, assignment-shaped)
 * so the ConformanceEngine can validate the BEHAVIOR properties that matter
 * (determinism, replay, event ordering) without coupling to engine internals.
 *
 * Determinism: the same Scenario MUST produce the same SimulationResult. The
 * engine draws all time from a FixedRuntimeClock(scenario.inputs.baseTime)
 * and all randomness from a SeededRandomSource(scenario.inputs.clockSeed).
 */
import type { Scenario } from "./scenario";
import type { ConformanceMetrics } from "./conformance-metrics";

/** A minimal event-envelope shape used by the simulation. */
export interface SimulatedEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly version: number;
  readonly timestamp: number;
}

/** A minimal match shape used by the simulation. */
export interface SimulatedMatch {
  readonly resourceId: string;
  readonly score: number;
}

/** A minimal assignment shape used by the simulation. */
export interface SimulatedAssignment {
  readonly resourceId: string;
  readonly status: string;
}

/** A minimal decision shape used by the simulation. */
export interface SimulatedDecision {
  readonly outcome: string;
  readonly rationale: string;
}

/** A single trace step the simulation emits. */
export interface SimulatedTraceStep {
  readonly step: string;
  readonly at: number;
  readonly detail: string;
}

export interface SimulationResult {
  readonly ok: boolean;
  readonly status: "ok" | "fail" | "abort";
  readonly events: readonly SimulatedEvent[];
  readonly matches: readonly SimulatedMatch[];
  readonly assignments: readonly SimulatedAssignment[];
  readonly decisions: readonly SimulatedDecision[];
  readonly metrics: ConformanceMetrics;
  readonly trace: readonly SimulatedTraceStep[];
  /** Present iff a failure-injection produced a failure. */
  readonly failure?: { readonly kind: string; readonly message: string };
}

export interface SimulationEngine {
  simulate(scenario: Scenario): SimulationResult;
}
