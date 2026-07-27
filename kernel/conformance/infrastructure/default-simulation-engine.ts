/**
 * @kernel/conformance/infrastructure/default-simulation-engine — the default
 * `SimulationEngine` implementation.
 *
 * Simulates the full kernel pipeline (compile → coordinate → resource →
 * knowledge → runtime) using GENERIC data shapes. It does NOT call the real
 * kernel engines — it produces output with the SAME CONTRACTS
 * (event-envelope-shaped, match-shaped, assignment-shaped) so the
 * ConformanceEngine can validate behavior properties (determinism, replay,
 * event ordering) without coupling to engine internals.
 *
 * Determinism (CRITICAL):
 *   - `FixedRuntimeClock(scenario.inputs.baseTime)` is the ONLY source of time.
 *   - `SeededRandomSource(scenario.inputs.clockSeed)` is the ONLY source of
 *     randomness (used to mint deterministic event ids).
 *   - NO `Date.now()` and NO `Math.random()` anywhere in this file.
 *   - Two runs of the same Scenario MUST produce identical SimulationResults.
 *
 * Pipeline:
 *   1. compile  — parse inputs, evaluate policies, build execution graph.
 *   2. inject    — apply failure injection (may short-circuit).
 *   3. coordinate — match demands to resources, create assignments.
 *   4. resource  — capacity/availability checks.
 *   5. knowledge — consult knowledge items.
 *   6. runtime   — emit final events.
 *
 * Matching ties are broken by `resourceId` lexicographic ASC (deterministic).
 */
import { hashSeed } from "@kernel/shared-kernel";
import type {
  ConformanceMetrics,
  Scenario,
  ScenarioResource,
  SimulatedAssignment,
  SimulatedDecision,
  SimulatedEvent,
  SimulatedMatch,
  SimulatedTraceStep,
  SimulationEngine,
  SimulationResult,
} from "../domain";
import {
  DefaultFailureInjector,
  type FailureInjector,
  type InjectionContext,
} from "./default-failure-injector";

// ── Stable canonical-JSON helper (deterministic checksum) ───────────────────

/**
 * Recursively sort object keys so the JSON output is stable regardless of
 * insertion order. Arrays preserve order (order is semantically meaningful).
 * Functions / symbols / undefined are dropped (they are not JSON-serialisable
 * and would break determinism).
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined && typeof obj[k] !== "function")
    .sort();
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") +
    "}"
  );
}

/**
 * The deterministic checksum of a simulation result. Hash of the canonical
 * JSON of (events + matches + assignments + decisions + metrics), computed
 * via `hashSeed` from `@kernel/shared-kernel`. Two identical simulation
 * runs produce the same checksum — this is the WHOLE POINT of the framework.
 */
export function computeDeterministicChecksum(input: {
  readonly events: readonly SimulatedEvent[];
  readonly matches: readonly SimulatedMatch[];
  readonly assignments: readonly SimulatedAssignment[];
  readonly decisions: readonly SimulatedDecision[];
  readonly metrics: ConformanceMetrics;
}): string {
  // Note: metrics.deterministicChecksum is excluded (it would be circular).
  const { deterministicChecksum: _omit, ...metricsRest } = input.metrics;
  void _omit;
  const payload = {
    events: input.events,
    matches: input.matches,
    assignments: input.assignments,
    decisions: input.decisions,
    metrics: metricsRest,
  };
  return hashSeed(stableStringify(payload)).toString(16).padStart(8, "0");
}

// ── Scoring constants ───────────────────────────────────────────────────────

const STATE_SCORE: Record<ScenarioResource["operationalState"], number> = {
  idle: 1.0,
  reserved: 0.8,
  committed: 0.7,
  busy: 0.5,
  degraded: 0.6,
  offline: 0.0,
  maintenance: 0.0,
  unavailable: 0.0,
};

// ── Engine ──────────────────────────────────────────────────────────────────

/**
 * Mutable simulation state — accumulates events / matches / assignments /
 * decisions / trace / metrics as the pipeline runs.
 */
interface SimulationState {
  events: SimulatedEvent[];
  matches: SimulatedMatch[];
  assignments: SimulatedAssignment[];
  decisions: SimulatedDecision[];
  trace: SimulatedTraceStep[];
  policyEvaluations: number;
  compilerStages: number;
  allocations: number;
  retries: number;
  failures: number;
  failure?: { kind: string; message: string };
  status: "ok" | "fail" | "abort";
  nextEventId: () => string;
  nextTimestamp: () => number;
}

export class DefaultSimulationEngine implements SimulationEngine {
  private readonly failureInjector: FailureInjector;

  constructor(failureInjector?: FailureInjector) {
    this.failureInjector = failureInjector ?? new DefaultFailureInjector();
  }

  simulate(scenario: Scenario): SimulationResult {
    const baseTime = scenario.inputs.baseTime;
    // Deterministic id/timestamp minters — pure functions of the seed + baseTime.
    let eventIdCounter = 0;
    let tsCounter = 0;
    // Inline seeded PRNG (mulberry32) so we don't need to import the runtime
    // module — the conformance module must depend ONLY on @kernel/shared-kernel.
    const seed = (scenario.inputs.clockSeed >>> 0) || 1;
    let prngState = seed;
    const nextRandom = (): number => {
      prngState = (prngState + 0x6d2b79f5) | 0;
      let t = Math.imul(prngState ^ (prngState >>> 15), 1 | prngState);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const nextEventId = (): string => {
      const bytes: number[] = new Array<number>(16);
      for (let i = 0; i < 16; i++) {
        bytes[i] = Math.floor(nextRandom() * 256);
      }
      bytes[6] = (bytes[6]! & 0x0f) | 0x40;
      bytes[8] = (bytes[8]! & 0x3f) | 0x80;
      const hex = bytes.map((b) => b.toString(16).padStart(2, "0"));
      eventIdCounter++;
      return (
        hex.slice(0, 4).join("") +
        "-" +
        hex.slice(4, 6).join("") +
        "-" +
        hex.slice(6, 8).join("") +
        "-" +
        hex.slice(8, 10).join("") +
        "-" +
        hex.slice(10, 16).join("")
      );
    };
    const nextTimestamp = (): number => {
      tsCounter++;
      return baseTime + tsCounter;
    };

    const state: SimulationState = {
      events: [],
      matches: [],
      assignments: [],
      decisions: [],
      trace: [],
      policyEvaluations: 0,
      compilerStages: 0,
      allocations: 0,
      retries: 0,
      failures: 0,
      status: "ok",
      nextEventId,
      nextTimestamp,
    };

    const injCtx: InjectionContext = { nextEventId, nextTimestamp };

    // ── Stage 1: compile ────────────────────────────────────────────────
    state.trace.push({
      step: "compile:parse",
      at: nextTimestamp(),
      detail: `Parsed ${scenario.inputs.resources.length} resources, ${scenario.inputs.demands.length} demands, ${scenario.inputs.capabilities.length} capabilities`,
    });
    state.compilerStages++;

    // Evaluate policies.
    let denied = false;
    for (const policy of scenario.inputs.policies) {
      state.policyEvaluations++;
      state.trace.push({
        step: "compile:policy",
        at: nextTimestamp(),
        detail: `Policy ${policy.id} (${policy.effect}) — ${policy.reason}`,
      });
      if (policy.effect === "deny") {
        denied = true;
        state.decisions.push({
          outcome: "policy:deny",
          rationale: `Policy ${policy.id} denied`,
        });
      } else if (policy.effect === "allow") {
        state.decisions.push({
          outcome: "policy:allow",
          rationale: `Policy ${policy.id} allowed`,
        });
      }
    }

    state.trace.push({
      step: "compile:build-graph",
      at: nextTimestamp(),
      detail: "Execution graph constructed",
    });
    state.compilerStages++;

    // ── Stage 2: failure injection ─────────────────────────────────────
    const injection = this.failureInjector.inject(scenario, injCtx);
    if (injection.injected) {
      for (const ev of injection.events) state.events.push(ev);
      for (const d of injection.decisions) state.decisions.push(d);
      for (const t of injection.traceSteps) state.trace.push(t);
      state.failure = injection.failure;
      if (injection.shortCircuit) {
        state.status = "abort";
        state.failures++;
        return this.finalize(state, scenario);
      }
    }

    // If a policy denied (and no short-circuit injection already fired), abort.
    if (denied) {
      state.status = "abort";
      state.failures++;
      state.events.push({
        eventId: nextEventId(),
        eventType: "CompilationAborted",
        version: 1,
        timestamp: nextTimestamp(),
      });
      return this.finalize(state, scenario);
    }

    // ── Stage 3: coordinate (matching) ─────────────────────────────────
    // Mutable capacity tracker — incremented after each successful match so
    // subsequent demands see the updated capacity (this is what makes the
    // conflicting-commitments scenario produce one committed + one deferred).
    const usedCapacity = new Map<string, number>();
    for (const r of scenario.inputs.resources) usedCapacity.set(r.id, r.capacity.used);

    for (const demand of scenario.inputs.demands) {
      const candidates: Array<{ resource: ScenarioResource; score: number; capLevel: number }> = [];
      for (const resource of scenario.inputs.resources) {
        // Operational gate.
        if (STATE_SCORE[resource.operationalState] === 0) continue;
        // Capacity gate (uses the mutable tracker).
        const used = usedCapacity.get(resource.id) ?? resource.capacity.used;
        if (used >= resource.capacity.max) continue;
        // Capability gate.
        let capLevel = 5;
        let hasCap = false;
        for (const capId of resource.capabilities) {
          const cap = scenario.inputs.capabilities.find((c) => c.id === capId);
          if (cap === undefined) continue;
          if (cap.capabilityType === demand.capabilityType && cap.providerResourceId === resource.id) {
            hasCap = true;
            capLevel = cap.level ?? 5;
            break;
          }
        }
        if (!hasCap) continue;
        const score = STATE_SCORE[resource.operationalState]! * (0.5 + 0.5 * Math.min(capLevel, 5) / 5);
        candidates.push({ resource, score: Math.round(score * 1000) / 1000, capLevel });
      }

      // Deterministic ordering: score DESC, resourceId ASC.
      candidates.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        return a.resource.id < b.resource.id ? -1 : a.resource.id > b.resource.id ? 1 : 0;
      });

      if (candidates.length === 0) {
        state.trace.push({
          step: "coordinate:match",
          at: nextTimestamp(),
          detail: `Demand ${demand.id} (${demand.capabilityType}) — no matching resource`,
        });
        state.events.push({
          eventId: nextEventId(),
          eventType: "NoMatchFound",
          version: 1,
          timestamp: nextTimestamp(),
        });
        state.decisions.push({
          outcome: "match:none",
          rationale: `No resource satisfies demand ${demand.id}`,
        });
        continue;
      }

      const best = candidates[0]!;
      state.matches.push({ resourceId: best.resource.id, score: best.score });
      state.allocations++;
      state.trace.push({
        step: "coordinate:match",
        at: nextTimestamp(),
        detail: `Demand ${demand.id} → Resource ${best.resource.id} (score ${best.score})`,
      });
      state.events.push({
        eventId: nextEventId(),
        eventType: "MatchSelected",
        version: 1,
        timestamp: nextTimestamp(),
      });
      state.decisions.push({
        outcome: "match:selected",
        rationale: `Resource ${best.resource.id} selected with score ${best.score}`,
      });

      // Reservation + commitment + assignment.
      state.events.push({
        eventId: nextEventId(),
        eventType: "ReservationConfirmed",
        version: 1,
        timestamp: nextTimestamp(),
      });
      state.events.push({
        eventId: nextEventId(),
        eventType: "CommitmentCreated",
        version: 1,
        timestamp: nextTimestamp(),
      });
      state.assignments.push({ resourceId: best.resource.id, status: "accepted" });
      state.events.push({
        eventId: nextEventId(),
        eventType: "AssignmentAccepted",
        version: 1,
        timestamp: nextTimestamp(),
      });
      state.decisions.push({
        outcome: "assignment:accepted",
        rationale: `Assignment accepted by ${best.resource.id}`,
      });
      // Decrement available capacity for this resource (mutable tracker).
      usedCapacity.set(best.resource.id, (usedCapacity.get(best.resource.id) ?? 0) + 1);
    }

    // Handle reservation-config scenarios (e.g. expired-reservation).
    for (const res of scenario.inputs.reservations ?? []) {
      const expiresAt = res.createdAt + res.ttlMs;
      if (expiresAt <= baseTime) {
        state.events.push({
          eventId: nextEventId(),
          eventType: "ReservationExpired",
          version: 1,
          timestamp: nextTimestamp(),
        });
        state.decisions.push({
          outcome: "reservation:expired",
          rationale: `Reservation ${res.id} expired`,
        });
        state.trace.push({
          step: "coordinate:reservation",
          at: nextTimestamp(),
          detail: `Reservation ${res.id} expired (ttl ${res.ttlMs}ms)`,
        });
      } else {
        state.events.push({
          eventId: nextEventId(),
          eventType: "ReservationHeld",
          version: 1,
          timestamp: nextTimestamp(),
        });
      }
    }

    // Handle transfer scenarios.
    for (const transfer of scenario.inputs.transfers ?? []) {
      state.events.push({
        eventId: nextEventId(),
        eventType: "TransferInitiated",
        version: 1,
        timestamp: nextTimestamp(),
      });
      state.events.push({
        eventId: nextEventId(),
        eventType: "TransferCompleted",
        version: 1,
        timestamp: nextTimestamp(),
      });
      state.decisions.push({
        outcome: "transfer:completed",
        rationale: `Assignment ${transfer.assignmentId} transferred ${transfer.fromResourceId} → ${transfer.toResourceId}`,
      });
      state.trace.push({
        step: "coordinate:transfer",
        at: nextTimestamp(),
        detail: `Transfer ${transfer.id}: ${transfer.fromResourceId} → ${transfer.toResourceId} (${transfer.reason})`,
      });
    }

    // Handle negotiation scenarios.
    for (const neg of scenario.inputs.negotiations ?? []) {
      const rounds = (neg.maxRounds + 1) >>> 0;
      for (let r = 1; r <= rounds; r++) {
        state.retries++;
        state.events.push({
          eventId: nextEventId(),
          eventType: "NegotiationRoundCompleted",
          version: r,
          timestamp: nextTimestamp(),
        });
      }
      if (rounds >= neg.maxRounds) {
        state.events.push({
          eventId: nextEventId(),
          eventType: "NegotiationExpired",
          version: 1,
          timestamp: nextTimestamp(),
        });
        state.decisions.push({
          outcome: "negotiation:expired",
          rationale: `Negotiation ${neg.id} exceeded ${neg.maxRounds} rounds`,
        });
      } else {
        state.decisions.push({
          outcome: "negotiation:agreed",
          rationale: `Negotiation ${neg.id} agreed in ${rounds} rounds`,
        });
      }
    }

    // Handle queue scenarios.
    for (const queue of scenario.inputs.queues ?? []) {
      const ordered = this.orderQueue(queue);
      state.trace.push({
        step: "coordinate:queue",
        at: nextTimestamp(),
        detail: `Queue ${queue.id} (${queue.discipline}) — ${ordered.length} entries dispatched: ${ordered
          .map((e) => e.itemRef)
          .join(",")}`,
      });
      for (const entry of ordered) {
        state.events.push({
          eventId: nextEventId(),
          eventType: "QueueEntryDequeued",
          version: 1,
          timestamp: nextTimestamp(),
        });
        state.trace.push({
          step: "coordinate:queue:dequeue",
          at: nextTimestamp(),
          detail: `Dequeued ${entry.itemRef}`,
        });
      }
      state.decisions.push({
        outcome: "queue:dispatched",
        rationale: `Queue ${queue.id} dispatched ${ordered.length} entries via ${queue.discipline}`,
      });
    }

    // Handle twin-update scenarios.
    for (const upd of scenario.inputs.twinUpdates ?? []) {
      state.events.push({
        eventId: nextEventId(),
        eventType: "TwinStateUpdated",
        version: 1,
        timestamp: nextTimestamp(),
      });
      state.events.push({
        eventId: nextEventId(),
        eventType: "TelemetryRecorded",
        version: 1,
        timestamp: nextTimestamp(),
      });
      state.decisions.push({
        outcome: "twin:updated",
        rationale: `Twin for ${upd.resourceId} updated (${upd.metric}=${upd.value}${upd.unit ?? ""})`,
      });
      state.trace.push({
        step: "resource:twin",
        at: nextTimestamp(),
        detail: `Twin ${upd.resourceId} ← ${upd.metric}=${upd.value}${upd.unit ?? ""}`,
      });
    }

    // ── Stage 4: resource (capacity) ───────────────────────────────────
    for (const resource of scenario.inputs.resources) {
      state.trace.push({
        step: "resource:capacity",
        at: nextTimestamp(),
        detail: `Resource ${resource.id} capacity ${resource.capacity.used}/${resource.capacity.max} ${resource.capacity.unit}`,
      });
    }

    // ── Stage 5: knowledge ─────────────────────────────────────────────
    for (const item of scenario.inputs.knowledgeItems) {
      if (item.status === "active") {
        state.events.push({
          eventId: nextEventId(),
          eventType: "KnowledgeConsulted",
          version: 1,
          timestamp: nextTimestamp(),
        });
        state.decisions.push({
          outcome: "knowledge:consulted",
          rationale: `Knowledge ${item.id} (${item.kind}) consulted`,
        });
      }
      state.trace.push({
        step: "knowledge:lookup",
        at: nextTimestamp(),
        detail: `Knowledge ${item.id} (${item.status}) — ${item.subject}`,
      });
    }

    // ── Stage 6: runtime (final event) ─────────────────────────────────
    state.events.push({
      eventId: nextEventId(),
      eventType: "PipelineCompleted",
      version: 1,
      timestamp: nextTimestamp(),
    });
    state.trace.push({
      step: "runtime:complete",
      at: nextTimestamp(),
      detail: `Pipeline completed — ${state.events.length} events, ${state.matches.length} matches, ${state.assignments.length} assignments`,
    });

    // Determine final status.
    if (state.matches.length === 0 && scenario.inputs.demands.length > 0) {
      state.status = "fail";
    } else {
      state.status = "ok";
    }

    return this.finalize(state, scenario);
  }

  /**
   * Order a queue's entries by its discipline. Deterministic:
   *   - fifo      — enqueuedAt ASC, then itemRef ASC.
   *   - priority  — priority DESC, then enqueuedAt ASC.
   *   - weighted  — weight DESC, then enqueuedAt ASC.
   *   - deadline  — deadline ASC (missing deadline sorts last), then enqueuedAt ASC.
   */
  private orderQueue(
    queue: NonNullable<Scenario["inputs"]["queues"]>[number]
  ): readonly { itemRef: string; priority?: number; weight?: number; deadline?: number; enqueuedAt: number }[] {
    const entries = queue.entries
      .map((e) => ({
        itemRef: e.itemRef,
        priority: e.priority,
        weight: e.weight,
        deadline: e.deadline,
        enqueuedAt: e.enqueuedAt,
      }))
      .slice();
    switch (queue.discipline) {
      case "fifo":
        entries.sort((a, b) => a.enqueuedAt - b.enqueuedAt || (a.itemRef < b.itemRef ? -1 : 1));
        break;
      case "priority":
        entries.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.enqueuedAt - b.enqueuedAt);
        break;
      case "weighted":
        entries.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || a.enqueuedAt - b.enqueuedAt);
        break;
      case "deadline":
        entries.sort((a, b) => {
          const ad = a.deadline ?? Number.MAX_SAFE_INTEGER;
          const bd = b.deadline ?? Number.MAX_SAFE_INTEGER;
          return ad - bd || a.enqueuedAt - b.enqueuedAt;
        });
        break;
    }
    return entries;
  }

  /**
   * Compute the final SimulationResult from the accumulated state. This
   * builds the ConformanceMetrics, computes the deterministic checksum, and
   * returns the immutable result.
   */
  private finalize(state: SimulationState, scenario: Scenario): SimulationResult {
    const lastTs =
      state.events.length === 0
        ? scenario.inputs.baseTime
        : state.events[state.events.length - 1]!.timestamp;
    const latencyMs = Math.max(0, lastTs - scenario.inputs.baseTime);
    const eventCount = state.events.length;
    const throughput = latencyMs === 0 ? eventCount : eventCount / latencyMs;

    const metricsWithoutChecksum = {
      latencyMs,
      allocations: state.allocations,
      retries: state.retries,
      failures: state.failures,
      throughput: Math.round(throughput * 1000) / 1000,
      policyEvaluations: state.policyEvaluations,
      compilerStages: state.compilerStages,
      eventCount,
      replaySuccess: true, // the conformance engine verifies this separately
    };

    const checksumInput = {
      events: state.events,
      matches: state.matches,
      assignments: state.assignments,
      decisions: state.decisions,
      metrics: metricsWithoutChecksum,
    };
    const deterministicChecksum = hashSeed(stableStringify(checksumInput)).toString(16).padStart(8, "0");

    const metrics: ConformanceMetrics = {
      ...metricsWithoutChecksum,
      replaySuccess: true,
      deterministicChecksum,
    };

    return {
      ok: state.status === "ok",
      status: state.status,
      events: state.events,
      matches: state.matches,
      assignments: state.assignments,
      decisions: state.decisions,
      metrics,
      trace: state.trace,
      failure: state.failure,
    };
  }
}
