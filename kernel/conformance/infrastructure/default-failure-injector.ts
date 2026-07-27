/**
 * @kernel/conformance/infrastructure/default-failure-injector — the default
 * `FailureInjector` implementation.
 *
 * Given a Scenario and a simulation context (clock + random + event-id
 * minting), it produces the events / decisions / trace steps that represent
 * the injected failure. If `scenario.failureInjection` is absent, it returns
 * `{ injected: false }` and the simulation continues normally.
 *
 * Every failure kind maps to a specific point in the pipeline:
 *
 *   `compiler-failure`         → stage `compile:build-graph`        (short-circuit)
 *   `extension-failure`        → stage `compile:extension`          (short-circuit)
 *   `package-incompatibility`  → stage `compile:package-check`      (short-circuit)
 *   `policy-failure`           → stage `compile:policy`             (short-circuit)
 *   `stale-knowledge`          → stage `knowledge:lookup`           (no short-circuit)
 *   `capacity-exhaustion`      → stage `resource:capacity`          (no short-circuit)
 *   `unavailable-resource`     → stage `coordinate:match`           (no short-circuit)
 *   `expired-reservation`      → stage `coordinate:reservation`     (no short-circuit)
 *   `network-partition`        → stage `coordinate:match`           (no short-circuit)
 *
 * Determinism: every event id is minted from the supplied SeededRandomSource
 * (uuid), every timestamp from the supplied FixedRuntimeClock. No Date.now,
 * no Math.random.
 */
import type {
  FailureInjectionConfig,
  Scenario,
} from "../domain";
import type {
  SimulatedDecision,
  SimulatedEvent,
  SimulatedTraceStep,
} from "../domain";

/** The mutable simulation context the injector draws from. */
export interface InjectionContext {
  /** Returns the next deterministic event id (UUID v4 from the seeded stream). */
  nextEventId(): string;
  /** Returns the next monotonic timestamp (baseTime + offset). */
  nextTimestamp(): number;
}

export interface InjectionResult {
  readonly injected: boolean;
  readonly failure?: { readonly kind: string; readonly message: string };
  readonly events: readonly SimulatedEvent[];
  readonly decisions: readonly SimulatedDecision[];
  readonly traceSteps: readonly SimulatedTraceStep[];
  /** If true, the simulation engine aborts the pipeline after applying. */
  readonly shortCircuit: boolean;
}

export interface FailureInjector {
  inject(scenario: Scenario, ctx: InjectionContext): InjectionResult;
}

export class DefaultFailureInjector implements FailureInjector {
  inject(scenario: Scenario, ctx: InjectionContext): InjectionResult {
    const cfg: FailureInjectionConfig | undefined = scenario.failureInjection;
    if (cfg === undefined) {
      return { injected: false, events: [], decisions: [], traceSteps: [], shortCircuit: false };
    }

    const events: SimulatedEvent[] = [];
    const decisions: SimulatedDecision[] = [];
    const traceSteps: SimulatedTraceStep[] = [];
    let shortCircuit = false;
    let message: string;

    switch (cfg.kind) {
      case "compiler-failure": {
        const stage = (cfg.params?.stage as string | undefined) ?? "build-graph";
        message = `Compiler stage '${stage}' failed for target '${cfg.target}'`;
        traceSteps.push({ step: `compile:${stage}`, at: ctx.nextTimestamp(), detail: message });
        events.push({
          eventId: ctx.nextEventId(),
          eventType: "CompilationFailed",
          version: 1,
          timestamp: ctx.nextTimestamp(),
        });
        decisions.push({ outcome: "compile:fail", rationale: message });
        shortCircuit = true;
        break;
      }
      case "extension-failure": {
        message = `Protocol extension '${cfg.target}' threw during compilation`;
        traceSteps.push({ step: "compile:extension", at: ctx.nextTimestamp(), detail: message });
        events.push({
          eventId: ctx.nextEventId(),
          eventType: "ExtensionStageFailed",
          version: 1,
          timestamp: ctx.nextTimestamp(),
        });
        decisions.push({ outcome: "compile:fail", rationale: message });
        shortCircuit = true;
        break;
      }
      case "package-incompatibility": {
        const required = (cfg.params?.requiredVersion as string | undefined) ?? "unknown";
        const available = (cfg.params?.availableVersion as string | undefined) ?? "unknown";
        message = `Package '${cfg.target}' requires kernel ${required}, installed ${available}`;
        traceSteps.push({
          step: "compile:package-check",
          at: ctx.nextTimestamp(),
          detail: message,
        });
        events.push({
          eventId: ctx.nextEventId(),
          eventType: "PackageRejected",
          version: 1,
          timestamp: ctx.nextTimestamp(),
        });
        decisions.push({ outcome: "package:rejected", rationale: message });
        shortCircuit = true;
        break;
      }
      case "policy-failure": {
        message = `Policy '${cfg.target}' denied compilation`;
        traceSteps.push({ step: "compile:policy", at: ctx.nextTimestamp(), detail: message });
        events.push({
          eventId: ctx.nextEventId(),
          eventType: "PolicyDeniedCompilation",
          version: 1,
          timestamp: ctx.nextTimestamp(),
        });
        decisions.push({ outcome: "policy:deny", rationale: message });
        shortCircuit = true;
        break;
      }
      case "stale-knowledge": {
        message = `Knowledge item '${cfg.target}' is retired; lookup returned empty`;
        traceSteps.push({ step: "knowledge:lookup", at: ctx.nextTimestamp(), detail: message });
        events.push({
          eventId: ctx.nextEventId(),
          eventType: "KnowledgeLookupEmpty",
          version: 1,
          timestamp: ctx.nextTimestamp(),
        });
        decisions.push({ outcome: "knowledge:empty", rationale: message });
        shortCircuit = false;
        break;
      }
      case "capacity-exhaustion": {
        message = `Resource '${cfg.target}' is at max capacity; no reservation possible`;
        traceSteps.push({
          step: "resource:capacity",
          at: ctx.nextTimestamp(),
          detail: message,
        });
        events.push({
          eventId: ctx.nextEventId(),
          eventType: "CapacityExhausted",
          version: 1,
          timestamp: ctx.nextTimestamp(),
        });
        decisions.push({ outcome: "capacity:exhausted", rationale: message });
        shortCircuit = false;
        break;
      }
      case "unavailable-resource": {
        message = `Resource '${cfg.target}' is unavailable; excluded from matching`;
        traceSteps.push({
          step: "coordinate:match",
          at: ctx.nextTimestamp(),
          detail: message,
        });
        events.push({
          eventId: ctx.nextEventId(),
          eventType: "ResourceUnavailable",
          version: 1,
          timestamp: ctx.nextTimestamp(),
        });
        decisions.push({ outcome: "match:excluded", rationale: message });
        shortCircuit = false;
        break;
      }
      case "expired-reservation": {
        message = `Reservation '${cfg.target}' TTL exceeded; released`;
        traceSteps.push({
          step: "coordinate:reservation",
          at: ctx.nextTimestamp(),
          detail: message,
        });
        events.push({
          eventId: ctx.nextEventId(),
          eventType: "ReservationExpired",
          version: 1,
          timestamp: ctx.nextTimestamp(),
        });
        decisions.push({ outcome: "reservation:expired", rationale: message });
        shortCircuit = false;
        break;
      }
      case "network-partition": {
        message = `Network partition simulated; resources unreachable for target '${cfg.target}'`;
        traceSteps.push({
          step: "coordinate:match",
          at: ctx.nextTimestamp(),
          detail: message,
        });
        events.push({
          eventId: ctx.nextEventId(),
          eventType: "NetworkPartitionDetected",
          version: 1,
          timestamp: ctx.nextTimestamp(),
        });
        decisions.push({ outcome: "match:partitioned", rationale: message });
        shortCircuit = false;
        break;
      }
      default: {
        // Unknown kind — record but do not inject.
        return { injected: false, events: [], decisions: [], traceSteps: [], shortCircuit: false };
      }
    }

    return {
      injected: true,
      failure: { kind: cfg.kind, message },
      events,
      decisions,
      traceSteps,
      shortCircuit,
    };
  }
}
