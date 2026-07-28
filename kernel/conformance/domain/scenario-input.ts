/**
 * @kernel/conformance/domain/scenario-input — the input bundle a Scenario
 * hands to the SimulationEngine.
 *
 * Every field is generic, plain, JSON-serialisable data. No industry terms.
 * `resources`, `capabilities`, `demands`, `intents` are structurally compatible
 * with the canonical shared-kernel primitives but expressed as plain records
 * (the conformance module defines its OWN scenario types so it stays decoupled
 * from the realised kernel engines — it validates CONTRACTS, not engine
 * internals).
 *
 * Determinism: `clockSeed` + `baseTime` ARE the entire source of time and
 * randomness inside a simulation run. The SimulationEngine builds a
 * `FixedRuntimeClock` from `baseTime` and a `SeededRandomSource` from
 * `clockSeed`. Two scenarios with the same `clockSeed`/`baseTime` produce
 * identical event sequences.
 */
import type { UnknownRecord } from "@kernel/shared-kernel";

/** A generic resource shape for a scenario (compatible with the canonical Resource). */
export interface ScenarioResource {
  readonly id: string;
  readonly resourceType: string;
  readonly displayName: string;
  readonly capabilities: readonly string[];
  readonly operationalState:
    | "idle"
    | "busy"
    | "reserved"
    | "committed"
    | "offline"
    | "maintenance"
    | "unavailable"
    | "degraded";
  readonly capacity: { readonly max: number; readonly unit: string; readonly used: number };
  readonly attributes?: UnknownRecord;
}

/** A generic capability shape for a scenario. */
export interface ScenarioCapability {
  readonly id: string;
  readonly capabilityType: string;
  readonly providerResourceId: string;
  readonly level?: number;
  readonly constraints?: UnknownRecord;
}

/** A generic demand shape for a scenario. */
export interface ScenarioDemand {
  readonly id: string;
  readonly intentId: string;
  readonly capabilityType: string;
  readonly quantity: { readonly amount: number; readonly unit: string };
  readonly priority: number;
  readonly window: { readonly start: number; readonly end: number };
  readonly constraints?: UnknownRecord;
}

/** A generic intent shape for a scenario. */
export interface ScenarioIntent {
  readonly id: string;
  readonly type: string;
  readonly priority: number;
  readonly payload?: UnknownRecord;
}

/** A generic policy rule applied during the simulated compile stage. */
export interface ScenarioPolicy {
  readonly id: string;
  readonly name: string;
  readonly effect: "allow" | "deny" | "prefer" | "penalize";
  readonly targetCapabilityType?: string;
  readonly targetResourceId?: string;
  readonly reason: string;
}

/** A generic knowledge item the simulated knowledge stage can look up. */
export interface ScenarioKnowledgeItem {
  readonly id: string;
  readonly kind: "fact" | "procedure" | "standard" | "guideline";
  readonly subject: string;
  readonly status: "active" | "retired" | "draft";
  readonly payload?: UnknownRecord;
}

/** A generic queue configuration for queueing-discipline scenarios. */
export interface ScenarioQueueConfig {
  readonly id: string;
  readonly discipline: "fifo" | "priority" | "weighted" | "deadline";
  readonly entries: readonly {
    readonly itemRef: string;
    readonly priority?: number;
    readonly weight?: number;
    readonly deadline?: number;
    readonly enqueuedAt: number;
  }[];
}

/** A generic reservation configuration for reservation scenarios. */
export interface ScenarioReservationConfig {
  readonly id: string;
  readonly resourceId: string;
  readonly capabilityType: string;
  readonly createdAt: number;
  readonly ttlMs: number;
  readonly quantity: { readonly amount: number; readonly unit: string };
}

/** A generic negotiation configuration for negotiation scenarios. */
export interface ScenarioNegotiationConfig {
  readonly id: string;
  readonly maxRounds: number;
  readonly participants: readonly string[];
  readonly startedAt: number;
}

/** A generic transfer configuration for transfer-provenance scenarios. */
export interface ScenarioTransferConfig {
  readonly id: string;
  readonly assignmentId: string;
  readonly fromResourceId: string;
  readonly toResourceId: string;
  readonly reason: string;
}

/** A generic twin-update configuration. */
export interface ScenarioTwinUpdateConfig {
  readonly resourceId: string;
  readonly metric: string;
  readonly value: number;
  readonly unit?: string;
}

/** A generic package configuration for package-incompatibility scenarios. */
export interface ScenarioPackageConfig {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly requiredKernelVersion: string;
  readonly availableKernelVersion: string;
}

/**
 * The full input bundle of a scenario. Every simulation draws time and
 * randomness from `baseTime` + `clockSeed` only — no Date.now(), no
 * Math.random().
 */
export interface ScenarioInput {
  readonly resources: readonly ScenarioResource[];
  readonly capabilities: readonly ScenarioCapability[];
  readonly demands: readonly ScenarioDemand[];
  readonly intents: readonly ScenarioIntent[];
  readonly policies: readonly ScenarioPolicy[];
  readonly knowledgeItems: readonly ScenarioKnowledgeItem[];
  readonly queues?: readonly ScenarioQueueConfig[];
  readonly reservations?: readonly ScenarioReservationConfig[];
  readonly negotiations?: readonly ScenarioNegotiationConfig[];
  readonly transfers?: readonly ScenarioTransferConfig[];
  readonly twinUpdates?: readonly ScenarioTwinUpdateConfig[];
  readonly packages?: readonly ScenarioPackageConfig[];
  /** Epoch-millis — the frozen clock the simulation starts from. */
  readonly baseTime: number;
  /** Seed for the seeded random source. Combined with replaySeed for stability. */
  readonly clockSeed: number;
  /** Free-form scenario configuration knobs (e.g. retry budget, TTL). */
  readonly configuration?: UnknownRecord;
}
