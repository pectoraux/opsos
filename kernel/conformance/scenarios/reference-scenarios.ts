/**
 * @kernel/conformance/scenarios/reference-scenarios — the 25 built-in generic
 * reference scenarios every OpsOS protocol MUST pass before packaging.
 *
 * Each scenario is industry-neutral: resources are named `Resource-A/B/C`,
 * capabilities `Capability-X/Y`, demands `Demand-1/2`, intents `Intent-1`,
 * tasks `Task-1`. NO industry terms (no cleaning, no drivers, no patients,
 * no workers, no buildings, no rooms) — these scenarios validate KERNEL
 * BEHAVIOR contracts (determinism, replay, event ordering, failure handling),
 * not domain-specific business logic.
 *
 * Categories covered (25 scenarios):
 *   single-resource-match, multi-resource-match, resource-unavailable,
 *   conflicting-commitments, policy-denial, policy-allow, timeout-escalation,
 *   reassignment, rollback, degraded-resource, missing-capability,
 *   capacity-exhaustion, expired-reservation, stale-knowledge,
 *   compiler-failure, package-incompatibility, extension-failure,
 *   network-partition, priority-queue, weighted-queue, deadline-queue,
 *   negotiation-timeout, escalation-trigger, transfer-provenance, twin-update.
 */
import type {
  Scenario,
  ScenarioAssertion,
  ScenarioCapability,
  ScenarioDemand,
  ScenarioIntent,
  ScenarioKnowledgeItem,
  ScenarioPolicy,
  ScenarioResource,
} from "../domain";

// ── Tiny factory helpers (keep scenario definitions terse & uniform) ────────

const BASE_TIME = 1_700_000_000_000; // 2023-11-14T22:13:20Z — a fixed epoch.

function res(
  id: string,
  state: ScenarioResource["operationalState"],
  caps: readonly string[],
  capacityMax = 4,
  capacityUsed = 0,
  displayName = id
): ScenarioResource {
  return {
    id,
    resourceType: "generic",
    displayName,
    capabilities: caps,
    operationalState: state,
    capacity: { max: capacityMax, unit: "slot", used: capacityUsed },
  };
}

function cap(
  id: string,
  capabilityType: string,
  providerResourceId: string,
  level?: number
): ScenarioCapability {
  return { id, capabilityType, providerResourceId, level };
}

function dem(
  id: string,
  capabilityType: string,
  intentId: string,
  priority = 5
): ScenarioDemand {
  return {
    id,
    intentId,
    capabilityType,
    quantity: { amount: 1, unit: "slot" },
    priority,
    window: { start: BASE_TIME, end: BASE_TIME + 3_600_000 },
  };
}

function intent(id: string, priority = 5): ScenarioIntent {
  return { id, type: "generic", priority };
}

function policy(
  id: string,
  effect: ScenarioPolicy["effect"],
  reason: string,
  targetCapabilityType?: string,
  targetResourceId?: string
): ScenarioPolicy {
  return { id, name: id, effect, reason, targetCapabilityType, targetResourceId };
}

function knowledge(
  id: string,
  status: ScenarioKnowledgeItem["status"],
  subject: string
): ScenarioKnowledgeItem {
  return { id, kind: "fact", subject, status };
}

function assert(
  id: string,
  description: string,
  op: string,
  args: readonly unknown[],
  severity: ScenarioAssertion["severity"] = "error"
): ScenarioAssertion {
  return { id, description, predicate: { op, args }, severity };
}

// ── 25 reference scenarios ──────────────────────────────────────────────────

/**
 * 1. single-resource-match — one resource, one demand → match + assign.
 */
export const SINGLE_RESOURCE_MATCH: Scenario = {
  id: "single-resource-match",
  name: "Single Resource Match",
  description:
    "One resource with Capability-X and one demand for capabilityType X. The simulation must select Resource-A, create a commitment, and accept the assignment.",
  category: "single-resource",
  replaySeed: 1001,
  inputs: {
    resources: [res("Resource-A", "idle", ["Capability-X"])],
    capabilities: [cap("Capability-X", "X", "Resource-A")],
    demands: [dem("Demand-1", "X", "Intent-1")],
    intents: [intent("Intent-1")],
    policies: [],
    knowledgeItems: [],
    baseTime: BASE_TIME,
    clockSeed: 1001,
  },
  expectedOutcomes: {
    expectedStatus: "ok",
    expectedMatchCount: 1,
    expectedAssignmentCount: 1,
  },
  assertions: [
    assert("a1", "Pipeline completed successfully", "result-ok", [true]),
    assert("a2", "Exactly one match produced", "match-count-eq", [1]),
    assert("a3", "Exactly one assignment produced", "assignment-count-eq", [1]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 2. multi-resource-match — three resources, one demand → best match selected.
 */
export const MULTI_RESOURCE_MATCH: Scenario = {
  id: "multi-resource-match",
  name: "Multi Resource Match",
  description:
    "Three resources (Resource-A idle, Resource-B reserved, Resource-C degraded) all expose Capability-X. The simulation must select Resource-A (highest score).",
  category: "multi-resource",
  replaySeed: 1002,
  inputs: {
    resources: [
      res("Resource-A", "idle", ["Capability-X"]),
      res("Resource-B", "reserved", ["Capability-X"]),
      res("Resource-C", "degraded", ["Capability-X"]),
    ],
    capabilities: [
      cap("Capability-X", "X", "Resource-A"),
      cap("Capability-X", "X", "Resource-B"),
      cap("Capability-X", "X", "Resource-C"),
    ],
    demands: [dem("Demand-1", "X", "Intent-1")],
    intents: [intent("Intent-1")],
    policies: [],
    knowledgeItems: [],
    baseTime: BASE_TIME,
    clockSeed: 1002,
  },
  expectedOutcomes: {
    expectedStatus: "ok",
    expectedMatchCount: 1,
    expectedAssignmentCount: 1,
  },
  assertions: [
    assert("a1", "Pipeline completed successfully", "result-ok", [true]),
    assert("a2", "Best match is Resource-A (idle, highest score)", "match-for-resource", ["Resource-A"]),
    assert("a3", "Only one match produced (the best candidate)", "match-count-eq", [1]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 3. resource-unavailable — resource in offline state → no match.
 */
export const RESOURCE_UNAVAILABLE: Scenario = {
  id: "resource-unavailable",
  name: "Resource Unavailable",
  description:
    "Resource-A is offline. The simulation must exclude it from matching and emit a ResourceUnavailable audit event.",
  category: "resource-unavailable",
  replaySeed: 1003,
  inputs: {
    resources: [res("Resource-A", "offline", ["Capability-X"])],
    capabilities: [cap("Capability-X", "X", "Resource-A")],
    demands: [dem("Demand-1", "X", "Intent-1")],
    intents: [intent("Intent-1")],
    policies: [],
    knowledgeItems: [],
    baseTime: BASE_TIME,
    clockSeed: 1003,
  },
  expectedOutcomes: {
    expectedStatus: "fail",
    expectedMatchCount: 0,
    expectedFailureKind: "unavailable-resource",
  },
  failureInjection: {
    kind: "unavailable-resource",
    target: "Resource-A",
    params: {},
  },
  assertions: [
    assert("a1", "Pipeline did not produce an ok result", "result-ok", [false]),
    assert("a2", "No match produced", "match-count-eq", [0]),
    assert("a3", "Failure kind is unavailable-resource", "failure-kind", ["unavailable-resource"]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 4. conflicting-commitments — two demands for same resource → one committed, one deferred.
 */
export const CONFLICTING_COMMITMENTS: Scenario = {
  id: "conflicting-commitments",
  name: "Conflicting Commitments",
  description:
    "Resource-A has capacity max=1. Two demands both require Capability-X. The first demand is committed; the second is deferred (no match because capacity is exhausted after the first assignment).",
  category: "conflicting-commitments",
  replaySeed: 1004,
  inputs: {
    resources: [res("Resource-A", "idle", ["Capability-X"], 1, 0)],
    capabilities: [cap("Capability-X", "X", "Resource-A")],
    demands: [dem("Demand-1", "X", "Intent-1"), dem("Demand-2", "X", "Intent-2")],
    intents: [intent("Intent-1"), intent("Intent-2")],
    policies: [],
    knowledgeItems: [],
    baseTime: BASE_TIME,
    clockSeed: 1004,
  },
  expectedOutcomes: {
    expectedStatus: "ok",
    expectedMatchCount: 1,
    expectedAssignmentCount: 1,
  },
  assertions: [
    assert("a1", "Pipeline completed (first demand matched)", "result-ok", [true]),
    assert("a2", "Exactly one match (first demand)", "match-count-eq", [1]),
    assert("a3", "Second demand deferred (match:none decision emitted)", "decision-outcome", ["match:none"]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 5. policy-denial — policy denies compilation → abort.
 */
export const POLICY_DENIAL: Scenario = {
  id: "policy-denial",
  name: "Policy Denial",
  description:
    "A policy with effect 'deny' targets Capability-X. The compiler must abort and emit a PolicyDeniedCompilation event.",
  category: "policy-denial",
  replaySeed: 1005,
  inputs: {
    resources: [res("Resource-A", "idle", ["Capability-X"])],
    capabilities: [cap("Capability-X", "X", "Resource-A")],
    demands: [dem("Demand-1", "X", "Intent-1")],
    intents: [intent("Intent-1")],
    policies: [policy("Policy-Deny-X", "deny", "Capability-X denied by governance", "X")],
    knowledgeItems: [],
    baseTime: BASE_TIME,
    clockSeed: 1005,
  },
  expectedOutcomes: {
    expectedStatus: "abort",
    expectedMatchCount: 0,
  },
  assertions: [
    assert("a1", "Pipeline aborted", "status-eq", ["abort"]),
    assert("a2", "No match produced", "match-count-eq", [0]),
    assert("a3", "Policy deny decision emitted", "decision-outcome", ["policy:deny"]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 6. policy-allow — policy allows → proceed.
 */
export const POLICY_ALLOW: Scenario = {
  id: "policy-allow",
  name: "Policy Allow",
  description:
    "A policy with effect 'allow' targets Capability-X. The compiler proceeds and the simulation produces a match.",
  category: "policy-allow",
  replaySeed: 1006,
  inputs: {
    resources: [res("Resource-A", "idle", ["Capability-X"])],
    capabilities: [cap("Capability-X", "X", "Resource-A")],
    demands: [dem("Demand-1", "X", "Intent-1")],
    intents: [intent("Intent-1")],
    policies: [policy("Policy-Allow-X", "allow", "Capability-X allowed by governance", "X")],
    knowledgeItems: [],
    baseTime: BASE_TIME,
    clockSeed: 1006,
  },
  expectedOutcomes: {
    expectedStatus: "ok",
    expectedMatchCount: 1,
  },
  assertions: [
    assert("a1", "Pipeline completed successfully", "result-ok", [true]),
    assert("a2", "Policy allow decision emitted", "decision-outcome", ["policy:allow"]),
    assert("a3", "One match produced", "match-count-eq", [1]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 7. timeout-escalation — reservation expires → escalation triggered.
 */
export const TIMEOUT_ESCALATION: Scenario = {
  id: "timeout-escalation",
  name: " Timeout Escalation",
  description:
    "A reservation for Resource-A was created with a 60s TTL, but the simulation clock is past the expiry. The reservation must be released and a ReservationExpired event emitted.",
  category: "timeout",
  replaySeed: 1007,
  inputs: {
    resources: [res("Resource-A", "idle", ["Capability-X"])],
    capabilities: [cap("Capability-X", "X", "Resource-A")],
    demands: [],
    intents: [],
    policies: [],
    knowledgeItems: [],
    reservations: [
      {
        id: "Reservation-1",
        resourceId: "Resource-A",
        capabilityType: "X",
        createdAt: BASE_TIME - 120_000,
        ttlMs: 60_000,
        quantity: { amount: 1, unit: "slot" },
      },
    ],
    baseTime: BASE_TIME,
    clockSeed: 1007,
  },
  expectedOutcomes: {
    expectedStatus: "ok",
    expectedFailureKind: "expired-reservation",
  },
  failureInjection: {
    kind: "expired-reservation",
    target: "Reservation-1",
    params: { ttlMs: 60_000 },
  },
  assertions: [
    assert("a1", "ReservationExpired event emitted", "event-emitted", ["ReservationExpired"]),
    assert("a2", "Reservation expired decision emitted", "decision-outcome", ["reservation:expired"]),
    assert("a3", "Failure kind is expired-reservation", "failure-kind", ["expired-reservation"]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 8. reassignment — assignment transferred from R1 to R2.
 */
export const REASSIGNMENT: Scenario = {
  id: "reassignment",
  name: "Reassignment",
  description:
    "An assignment is transferred from Resource-A to Resource-B. TransferInitiated and TransferCompleted events must be emitted and the assignment's new owner recorded.",
  category: "reassignment",
  replaySeed: 1008,
  inputs: {
    resources: [
      res("Resource-A", "idle", ["Capability-X"]),
      res("Resource-B", "idle", ["Capability-X"]),
    ],
    capabilities: [
      cap("Capability-X", "X", "Resource-A"),
      cap("Capability-X", "X", "Resource-B"),
    ],
    demands: [],
    intents: [],
    policies: [],
    knowledgeItems: [],
    transfers: [
      {
        id: "Transfer-1",
        assignmentId: "Assignment-1",
        fromResourceId: "Resource-A",
        toResourceId: "Resource-B",
        reason: "reassignment for load balancing",
      },
    ],
    baseTime: BASE_TIME,
    clockSeed: 1008,
  },
  expectedOutcomes: {
    expectedStatus: "ok",
  },
  assertions: [
    assert("a1", "TransferInitiated event emitted", "event-emitted", ["TransferInitiated"]),
    assert("a2", "TransferCompleted event emitted", "event-emitted", ["TransferCompleted"]),
    assert("a3", "Transfer decision emitted", "decision-outcome", ["transfer:completed"]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 9. rollback — package rollback to previous version.
 *
 * Modelled as a transfer back to the prior resource (Resource-B → Resource-A)
 * with reason 'rollback to previous version'. The transfer mechanism
 * captures the rollback semantics.
 */
export const ROLLBACK: Scenario = {
  id: "rollback",
  name: "Rollback",
  description:
    "An assignment that was transferred to Resource-B is rolled back to Resource-A (the previous version). The transfer mechanism captures the rollback semantics.",
  category: "rollback",
  replaySeed: 1009,
  inputs: {
    resources: [
      res("Resource-A", "idle", ["Capability-X"]),
      res("Resource-B", "idle", ["Capability-X"]),
    ],
    capabilities: [
      cap("Capability-X", "X", "Resource-A"),
      cap("Capability-X", "X", "Resource-B"),
    ],
    demands: [],
    intents: [],
    policies: [],
    knowledgeItems: [],
    transfers: [
      {
        id: "Transfer-Rollback-1",
        assignmentId: "Assignment-1",
        fromResourceId: "Resource-B",
        toResourceId: "Resource-A",
        reason: "rollback to previous version",
      },
    ],
    baseTime: BASE_TIME,
    clockSeed: 1009,
  },
  expectedOutcomes: {
    expectedStatus: "ok",
  },
  assertions: [
    assert("a1", "TransferInitiated event emitted (rollback started)", "event-emitted", ["TransferInitiated"]),
    assert("a2", "TransferCompleted event emitted (rollback completed)", "event-emitted", ["TransferCompleted"]),
    assert("a3", "Transfer decision emitted", "decision-outcome", ["transfer:completed"]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 10. degraded-resource — resource in degraded state → matched with lower score.
 */
export const DEGRADED_RESOURCE: Scenario = {
  id: "degraded-resource",
  name: "Degraded Resource",
  description:
    "Resource-A is in degraded operational state. The simulation must still match it (degraded is a valid candidate) but with a lower score than an idle resource.",
  category: "degraded-resource",
  replaySeed: 1010,
  inputs: {
    resources: [res("Resource-A", "degraded", ["Capability-X"])],
    capabilities: [cap("Capability-X", "X", "Resource-A")],
    demands: [dem("Demand-1", "X", "Intent-1")],
    intents: [intent("Intent-1")],
    policies: [],
    knowledgeItems: [],
    baseTime: BASE_TIME,
    clockSeed: 1010,
  },
  expectedOutcomes: {
    expectedStatus: "ok",
    expectedMatchCount: 1,
  },
  assertions: [
    assert("a1", "Pipeline completed successfully", "result-ok", [true]),
    assert("a2", "Degraded Resource-A still matched", "match-for-resource", ["Resource-A"]),
    assert("a3", "One allocation recorded", "metric-eq", ["allocations", 1]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 11. missing-capability — no resource has required capability → no match.
 */
export const MISSING_CAPABILITY: Scenario = {
  id: "missing-capability",
  name: "Missing Capability",
  description:
    "Resource-A exposes Capability-X but the demand requires capabilityType Y. No resource satisfies the demand; NoMatchFound must be emitted.",
  category: "missing-capability",
  replaySeed: 1011,
  inputs: {
    resources: [res("Resource-A", "idle", ["Capability-X"])],
    capabilities: [cap("Capability-X", "X", "Resource-A")],
    demands: [dem("Demand-1", "Y", "Intent-1")],
    intents: [intent("Intent-1")],
    policies: [],
    knowledgeItems: [],
    baseTime: BASE_TIME,
    clockSeed: 1011,
  },
  expectedOutcomes: {
    expectedStatus: "fail",
    expectedMatchCount: 0,
  },
  assertions: [
    assert("a1", "Pipeline did not produce an ok result", "result-ok", [false]),
    assert("a2", "No match produced", "match-count-eq", [0]),
    assert("a3", "NoMatchFound event emitted", "event-emitted", ["NoMatchFound"]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 12. capacity-exhaustion — resource at max capacity → no reservation.
 */
export const CAPACITY_EXHAUSTION: Scenario = {
  id: "capacity-exhaustion",
  name: "Capacity Exhaustion",
  description:
    "Resource-A is at max capacity (used=max). The simulation must exclude it from matching and emit a CapacityExhausted audit event.",
  category: "capacity-exhaustion",
  replaySeed: 1012,
  inputs: {
    resources: [res("Resource-A", "idle", ["Capability-X"], 1, 1)],
    capabilities: [cap("Capability-X", "X", "Resource-A")],
    demands: [dem("Demand-1", "X", "Intent-1")],
    intents: [intent("Intent-1")],
    policies: [],
    knowledgeItems: [],
    baseTime: BASE_TIME,
    clockSeed: 1012,
  },
  expectedOutcomes: {
    expectedStatus: "fail",
    expectedMatchCount: 0,
    expectedFailureKind: "capacity-exhaustion",
  },
  failureInjection: {
    kind: "capacity-exhaustion",
    target: "Resource-A",
    params: {},
  },
  assertions: [
    assert("a1", "Pipeline did not produce an ok result", "result-ok", [false]),
    assert("a2", "No match produced", "match-count-eq", [0]),
    assert("a3", "Failure kind is capacity-exhaustion", "failure-kind", ["capacity-exhaustion"]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 13. expired-reservation — reservation TTL exceeded → released.
 */
export const EXPIRED_RESERVATION: Scenario = {
  id: "expired-reservation",
  name: "Expired Reservation",
  description:
    "A reservation for Resource-A was created 120s ago with a 60s TTL. The simulation clock is past expiry; ReservationExpired must be emitted.",
  category: "expired-reservation",
  replaySeed: 1013,
  inputs: {
    resources: [res("Resource-A", "idle", ["Capability-X"])],
    capabilities: [cap("Capability-X", "X", "Resource-A")],
    demands: [],
    intents: [],
    policies: [],
    knowledgeItems: [],
    reservations: [
      {
        id: "Reservation-2",
        resourceId: "Resource-A",
        capabilityType: "X",
        createdAt: BASE_TIME - 120_000,
        ttlMs: 60_000,
        quantity: { amount: 1, unit: "slot" },
      },
    ],
    baseTime: BASE_TIME,
    clockSeed: 1013,
  },
  expectedOutcomes: {
    expectedStatus: "ok",
    expectedFailureKind: "expired-reservation",
  },
  failureInjection: {
    kind: "expired-reservation",
    target: "Reservation-2",
    params: { ttlMs: 60_000 },
  },
  assertions: [
    assert("a1", "ReservationExpired event emitted", "event-emitted", ["ReservationExpired"]),
    assert("a2", "Failure kind is expired-reservation", "failure-kind", ["expired-reservation"]),
    assert("a3", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 14. stale-knowledge — knowledge item retired → lookup returns empty.
 */
export const STALE_KNOWLEDGE: Scenario = {
  id: "stale-knowledge",
  name: "Stale Knowledge",
  description:
    "Knowledge item Knowledge-1 is in retired status. A lookup must return empty and emit KnowledgeLookupEmpty.",
  category: "stale-knowledge",
  replaySeed: 1014,
  inputs: {
    resources: [res("Resource-A", "idle", ["Capability-X"])],
    capabilities: [cap("Capability-X", "X", "Resource-A")],
    demands: [dem("Demand-1", "X", "Intent-1")],
    intents: [intent("Intent-1")],
    policies: [],
    knowledgeItems: [knowledge("Knowledge-1", "retired", "Capability-X standard")],
    baseTime: BASE_TIME,
    clockSeed: 1014,
  },
  expectedOutcomes: {
    expectedStatus: "ok",
    expectedFailureKind: "stale-knowledge",
  },
  failureInjection: {
    kind: "stale-knowledge",
    target: "Knowledge-1",
    params: {},
  },
  assertions: [
    assert("a1", "KnowledgeLookupEmpty event emitted", "event-emitted", ["KnowledgeLookupEmpty"]),
    assert("a2", "Failure kind is stale-knowledge", "failure-kind", ["stale-knowledge"]),
    assert("a3", "Knowledge empty decision emitted", "decision-outcome", ["knowledge:empty"]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 15. compiler-failure — compiler stage fails → graph not built.
 */
export const COMPILER_FAILURE: Scenario = {
  id: "compiler-failure",
  name: "Compiler Failure",
  description:
    "The compiler's build-graph stage fails for the target. The pipeline must abort and emit CompilationFailed.",
  category: "compiler-failure",
  replaySeed: 1015,
  inputs: {
    resources: [res("Resource-A", "idle", ["Capability-X"])],
    capabilities: [cap("Capability-X", "X", "Resource-A")],
    demands: [dem("Demand-1", "X", "Intent-1")],
    intents: [intent("Intent-1")],
    policies: [],
    knowledgeItems: [],
    baseTime: BASE_TIME,
    clockSeed: 1015,
  },
  expectedOutcomes: {
    expectedStatus: "abort",
    expectedFailureKind: "compiler-failure",
  },
  failureInjection: {
    kind: "compiler-failure",
    target: "Graph-1",
    params: { stage: "build-graph" },
  },
  assertions: [
    assert("a1", "Pipeline aborted", "status-eq", ["abort"]),
    assert("a2", "CompilationFailed event emitted", "event-emitted", ["CompilationFailed"]),
    assert("a3", "Failure kind is compiler-failure", "failure-kind", ["compiler-failure"]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 16. package-incompatibility — kernel component version mismatch → install rejected.
 */
export const PACKAGE_INCOMPATIBILITY: Scenario = {
  id: "package-incompatibility",
  name: "Package Incompatibility",
  description:
    "A kernel component requires kernel version 2.0 but the installed version is 1.0. The pipeline must abort and emit PackageRejected.",
  category: "package-incompatibility",
  replaySeed: 1016,
  inputs: {
    resources: [],
    capabilities: [],
    demands: [],
    intents: [],
    policies: [],
    knowledgeItems: [],
    packages: [
      {
        id: "Package-1",
        name: "Component-A",
        version: "1.0.0",
        requiredKernelVersion: "2.0",
        availableKernelVersion: "1.0",
      },
    ],
    baseTime: BASE_TIME,
    clockSeed: 1016,
  },
  expectedOutcomes: {
    expectedStatus: "abort",
    expectedFailureKind: "package-incompatibility",
  },
  failureInjection: {
    kind: "package-incompatibility",
    target: "Package-1",
    params: { requiredVersion: "2.0", availableVersion: "1.0" },
  },
  assertions: [
    assert("a1", "Pipeline aborted", "status-eq", ["abort"]),
    assert("a2", "PackageRejected event emitted", "event-emitted", ["PackageRejected"]),
    assert("a3", "Failure kind is package-incompatibility", "failure-kind", ["package-incompatibility"]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 17. extension-failure — protocol compiler stage throws → pipeline aborts.
 */
export const EXTENSION_FAILURE: Scenario = {
  id: "extension-failure",
  name: "Extension Failure",
  description:
    "A protocol extension throws during the compiler's extension stage. The pipeline must abort and emit ExtensionStageFailed.",
  category: "extension-failure",
  replaySeed: 1017,
  inputs: {
    resources: [res("Resource-A", "idle", ["Capability-X"])],
    capabilities: [cap("Capability-X", "X", "Resource-A")],
    demands: [dem("Demand-1", "X", "Intent-1")],
    intents: [intent("Intent-1")],
    policies: [],
    knowledgeItems: [],
    baseTime: BASE_TIME,
    clockSeed: 1017,
  },
  expectedOutcomes: {
    expectedStatus: "abort",
    expectedFailureKind: "extension-failure",
  },
  failureInjection: {
    kind: "extension-failure",
    target: "Extension-Custom-1",
    params: {},
  },
  assertions: [
    assert("a1", "Pipeline aborted", "status-eq", ["abort"]),
    assert("a2", "ExtensionStageFailed event emitted", "event-emitted", ["ExtensionStageFailed"]),
    assert("a3", "Failure kind is extension-failure", "failure-kind", ["extension-failure"]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 18. network-partition — simulated partition → resources unreachable.
 */
export const NETWORK_PARTITION: Scenario = {
  id: "network-partition",
  name: "Network Partition",
  description:
    "A network partition is simulated; Resource-A is unreachable (offline). No match is produced and NetworkPartitionDetected is emitted.",
  category: "network-partition",
  replaySeed: 1018,
  inputs: {
    resources: [res("Resource-A", "offline", ["Capability-X"])],
    capabilities: [cap("Capability-X", "X", "Resource-A")],
    demands: [dem("Demand-1", "X", "Intent-1")],
    intents: [intent("Intent-1")],
    policies: [],
    knowledgeItems: [],
    baseTime: BASE_TIME,
    clockSeed: 1018,
  },
  expectedOutcomes: {
    expectedStatus: "fail",
    expectedMatchCount: 0,
    expectedFailureKind: "network-partition",
  },
  failureInjection: {
    kind: "network-partition",
    target: "Resource-A",
    params: {},
  },
  assertions: [
    assert("a1", "Pipeline did not produce an ok result", "result-ok", [false]),
    assert("a2", "No match produced", "match-count-eq", [0]),
    assert("a3", "Failure kind is network-partition", "failure-kind", ["network-partition"]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 19. priority-queue — FIFO vs priority ordering.
 */
export const PRIORITY_QUEUE: Scenario = {
  id: "priority-queue",
  name: "Priority Queue",
  description:
    "A priority queue with three entries (priorities 1, 5, 3). Entries must be dispatched in priority DESC order.",
  category: "priority-queue",
  replaySeed: 1019,
  inputs: {
    resources: [],
    capabilities: [],
    demands: [],
    intents: [],
    policies: [],
    knowledgeItems: [],
    queues: [
      {
        id: "Queue-1",
        discipline: "priority",
        entries: [
          { itemRef: "Item-A", priority: 1, enqueuedAt: BASE_TIME },
          { itemRef: "Item-B", priority: 5, enqueuedAt: BASE_TIME + 1 },
          { itemRef: "Item-C", priority: 3, enqueuedAt: BASE_TIME + 2 },
        ],
      },
    ],
    baseTime: BASE_TIME,
    clockSeed: 1019,
  },
  expectedOutcomes: {
    expectedStatus: "ok",
  },
  assertions: [
    assert("a1", "QueueEntryDequeued event emitted", "event-emitted", ["QueueEntryDequeued"]),
    assert("a2", "Queue dispatched decision emitted", "decision-outcome", ["queue:dispatched"]),
    assert("a3", "Three entries dispatched (3 dequeue events + 1 completion)", "metric-eq", ["eventCount", 4]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 20. weighted-queue — weighted dequeue ordering.
 */
export const WEIGHTED_QUEUE: Scenario = {
  id: "weighted-queue",
  name: "Weighted Queue",
  description:
    "A weighted queue with three entries (weights 10, 50, 30). Entries must be dispatched in weight DESC order.",
  category: "weighted-queue",
  replaySeed: 1020,
  inputs: {
    resources: [],
    capabilities: [],
    demands: [],
    intents: [],
    policies: [],
    knowledgeItems: [],
    queues: [
      {
        id: "Queue-2",
        discipline: "weighted",
        entries: [
          { itemRef: "Item-A", weight: 10, enqueuedAt: BASE_TIME },
          { itemRef: "Item-B", weight: 50, enqueuedAt: BASE_TIME + 1 },
          { itemRef: "Item-C", weight: 30, enqueuedAt: BASE_TIME + 2 },
        ],
      },
    ],
    baseTime: BASE_TIME,
    clockSeed: 1020,
  },
  expectedOutcomes: {
    expectedStatus: "ok",
  },
  assertions: [
    assert("a1", "QueueEntryDequeued event emitted", "event-emitted", ["QueueEntryDequeued"]),
    assert("a2", "Queue dispatched decision emitted", "decision-outcome", ["queue:dispatched"]),
    assert("a3", "Three entries dispatched (3 dequeue events + 1 completion)", "metric-eq", ["eventCount", 4]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 21. deadline-queue — earliest-deadline-first ordering.
 */
export const DEADLINE_QUEUE: Scenario = {
  id: "deadline-queue",
  name: "Deadline Queue",
  description:
    "A deadline queue with three entries (deadlines 300, 100, 200). Entries must be dispatched earliest-deadline-first.",
  category: "deadline-queue",
  replaySeed: 1021,
  inputs: {
    resources: [],
    capabilities: [],
    demands: [],
    intents: [],
    policies: [],
    knowledgeItems: [],
    queues: [
      {
        id: "Queue-3",
        discipline: "deadline",
        entries: [
          { itemRef: "Item-A", deadline: 300, enqueuedAt: BASE_TIME },
          { itemRef: "Item-B", deadline: 100, enqueuedAt: BASE_TIME + 1 },
          { itemRef: "Item-C", deadline: 200, enqueuedAt: BASE_TIME + 2 },
        ],
      },
    ],
    baseTime: BASE_TIME,
    clockSeed: 1021,
  },
  expectedOutcomes: {
    expectedStatus: "ok",
  },
  assertions: [
    assert("a1", "QueueEntryDequeued event emitted", "event-emitted", ["QueueEntryDequeued"]),
    assert("a2", "Queue dispatched decision emitted", "decision-outcome", ["queue:dispatched"]),
    assert("a3", "Three entries dispatched (3 dequeue events + 1 completion)", "metric-eq", ["eventCount", 4]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 22. negotiation-timeout — negotiation exceeds maxRounds → expired.
 */
export const NEGOTIATION_TIMEOUT: Scenario = {
  id: "negotiation-timeout",
  name: "Negotiation Timeout",
  description:
    "A negotiation between Resource-A and Resource-B allows 3 rounds. The simulation runs all 3 rounds and then expires (no agreement).",
  category: "negotiation-timeout",
  replaySeed: 1022,
  inputs: {
    resources: [
      res("Resource-A", "idle", ["Capability-X"]),
      res("Resource-B", "idle", ["Capability-X"]),
    ],
    capabilities: [
      cap("Capability-X", "X", "Resource-A"),
      cap("Capability-X", "X", "Resource-B"),
    ],
    demands: [],
    intents: [],
    policies: [],
    knowledgeItems: [],
    negotiations: [
      {
        id: "Negotiation-1",
        maxRounds: 3,
        participants: ["Resource-A", "Resource-B"],
        startedAt: BASE_TIME,
      },
    ],
    baseTime: BASE_TIME,
    clockSeed: 1022,
  },
  expectedOutcomes: {
    expectedStatus: "ok",
  },
  assertions: [
    assert("a1", "NegotiationExpired event emitted", "event-emitted", ["NegotiationExpired"]),
    assert("a2", "Negotiation expired decision emitted", "decision-outcome", ["negotiation:expired"]),
    assert("a3", "At least 3 retries recorded", "metric-gte", ["retries", 3]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 23. escalation-trigger — capacity shortage triggers escalation.
 */
export const ESCALATION_TRIGGER: Scenario = {
  id: "escalation-trigger",
  name: "Escalation Trigger",
  description:
    "Resource-A is at max capacity. A demand for Capability-X cannot be satisfied; the capacity-exhaustion failure triggers an escalation audit event.",
  category: "escalation-trigger",
  replaySeed: 1023,
  inputs: {
    resources: [res("Resource-A", "idle", ["Capability-X"], 1, 1)],
    capabilities: [cap("Capability-X", "X", "Resource-A")],
    demands: [dem("Demand-1", "X", "Intent-1")],
    intents: [intent("Intent-1")],
    policies: [],
    knowledgeItems: [],
    baseTime: BASE_TIME,
    clockSeed: 1023,
  },
  expectedOutcomes: {
    expectedStatus: "fail",
    expectedFailureKind: "capacity-exhaustion",
  },
  failureInjection: {
    kind: "capacity-exhaustion",
    target: "Resource-A",
    params: { escalation: true },
  },
  assertions: [
    assert("a1", "CapacityExhausted event emitted", "event-emitted", ["CapacityExhausted"]),
    assert("a2", "Failure kind is capacity-exhaustion", "failure-kind", ["capacity-exhaustion"]),
    assert("a3", "No match produced", "match-count-eq", [0]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 24. transfer-provenance — transfer maintains full provenance chain.
 */
export const TRANSFER_PROVENANCE: Scenario = {
  id: "transfer-provenance",
  name: "Transfer Provenance",
  description:
    "An assignment is transferred from Resource-A to Resource-B with reason 'provenance chain maintained'. The transfer events must be emitted and the provenance chain recorded in the decision rationale.",
  category: "transfer-provenance",
  replaySeed: 1024,
  inputs: {
    resources: [
      res("Resource-A", "idle", ["Capability-X"]),
      res("Resource-B", "idle", ["Capability-X"]),
    ],
    capabilities: [
      cap("Capability-X", "X", "Resource-A"),
      cap("Capability-X", "X", "Resource-B"),
    ],
    demands: [],
    intents: [],
    policies: [],
    knowledgeItems: [],
    transfers: [
      {
        id: "Transfer-Provenance-1",
        assignmentId: "Assignment-1",
        fromResourceId: "Resource-A",
        toResourceId: "Resource-B",
        reason: "provenance chain maintained",
      },
    ],
    baseTime: BASE_TIME,
    clockSeed: 1024,
  },
  expectedOutcomes: {
    expectedStatus: "ok",
  },
  assertions: [
    assert("a1", "TransferInitiated event emitted", "event-emitted", ["TransferInitiated"]),
    assert("a2", "TransferCompleted event emitted", "event-emitted", ["TransferCompleted"]),
    assert("a3", "Transfer decision emitted with provenance rationale", "decision-outcome", ["transfer:completed"]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

/**
 * 25. twin-update — resource twin state updated + telemetry recorded.
 */
export const TWIN_UPDATE: Scenario = {
  id: "twin-update",
  name: "Twin Update",
  description:
    "Resource-A's twin state is updated with a new metric reading. TwinStateUpdated and TelemetryRecorded events must be emitted.",
  category: "twin-update",
  replaySeed: 1025,
  inputs: {
    resources: [res("Resource-A", "idle", ["Capability-X"])],
    capabilities: [cap("Capability-X", "X", "Resource-A")],
    demands: [],
    intents: [],
    policies: [],
    knowledgeItems: [],
    twinUpdates: [
      {
        resourceId: "Resource-A",
        metric: "load",
        value: 0.42,
        unit: "ratio",
      },
    ],
    baseTime: BASE_TIME,
    clockSeed: 1025,
  },
  expectedOutcomes: {
    expectedStatus: "ok",
  },
  assertions: [
    assert("a1", "TwinStateUpdated event emitted", "event-emitted", ["TwinStateUpdated"]),
    assert("a2", "TelemetryRecorded event emitted", "event-emitted", ["TelemetryRecorded"]),
    assert("a3", "Twin updated decision emitted", "decision-outcome", ["twin:updated"]),
    assert("a4", "Replay produces identical checksums", "replay-verified", [true], "fatal"),
  ],
};

// ── The full suite ──────────────────────────────────────────────────────────

/**
 * The 25 reference scenarios every OpsOS protocol MUST pass before packaging.
 * Industry-neutral; validates kernel BEHAVIOR contracts only.
 */
export const REFERENCE_SCENARIOS: readonly Scenario[] = [
  SINGLE_RESOURCE_MATCH,
  MULTI_RESOURCE_MATCH,
  RESOURCE_UNAVAILABLE,
  CONFLICTING_COMMITMENTS,
  POLICY_DENIAL,
  POLICY_ALLOW,
  TIMEOUT_ESCALATION,
  REASSIGNMENT,
  ROLLBACK,
  DEGRADED_RESOURCE,
  MISSING_CAPABILITY,
  CAPACITY_EXHAUSTION,
  EXPIRED_RESERVATION,
  STALE_KNOWLEDGE,
  COMPILER_FAILURE,
  PACKAGE_INCOMPATIBILITY,
  EXTENSION_FAILURE,
  NETWORK_PARTITION,
  PRIORITY_QUEUE,
  WEIGHTED_QUEUE,
  DEADLINE_QUEUE,
  NEGOTIATION_TIMEOUT,
  ESCALATION_TRIGGER,
  TRANSFER_PROVENANCE,
  TWIN_UPDATE,
];
