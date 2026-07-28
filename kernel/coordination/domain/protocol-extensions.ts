/**
 * @kernel/coordination/domain/protocol-extensions — the 8 ports that protocols
 * register with the Coordination Kernel.
 *
 * Per ADR-0010, the kernel ships the coordination ENGINES (deterministic
 * algorithms over the canonical coordination primitives). It does NOT ship the
 * business-specific policies, objectives, or strategies — those are supplied
 * by protocols (e.g. a marketplace protocol, a fleet-assignment protocol, a
 * staff-rostering protocol) and installed via these 8 ports.
 *
 * The 8 ports:
 *   1. MatchingStrategy             — re-ranks the matching engine's candidates.
 *   2. NegotiationRulesProvider     — supplies NegotiationRules per offer.
 *   3. QueuePolicyProvider          — maps queue names → disciplines.
 *   4. ReservationPolicyProvider    — caps reservation TTLs.
 *   5. EscalationPolicyProvider     — supplies a policy bundle.
 *   6. OptimizationObjectiveProvider— supplies the active ObjectiveFunction.
 *   7. CapabilityRanking            — re-orders capabilities per context.
 *   8. AvailabilityModel            — answers "is `resourceId` available in `window`?".
 *
 * Every port is a small, single-method interface — a protocol MAY register
 * multiple implementations, and the kernel composes them in declaration order
 * (first-registered-first-consulted). All ports are pure: their methods take
 * data and return data; none consult the wall clock or `Math.random()`.
 */

import type {
  OfferId,
  ResourceId,
  Capability,
  ObjectiveFunction,
  UnknownRecord,
  Match,
} from "@kernel/shared-kernel";
import type { TemporalWindow } from "@kernel/shared-kernel";
import type { QueueDiscipline } from "@kernel/shared-kernel";

import type { MatchRequest } from "./matching-engine";
import type { NegotiationRules } from "./negotiation-engine";
import type { EscalationPolicy } from "./escalation-engine";

// ── 1. MatchingStrategy ────────────────────────────────────────────────────

/**
 * Re-ranks the matching engine's candidate list. The default engine ranking is
 * by score descending with `resourceId` lexicographic tie-break. A protocol
 * MAY install a `MatchingStrategy` to apply a different ranking (e.g. fairness
 * across tenants, sticky-affinity to prior resource).
 */
export interface MatchingStrategy {
  readonly name: string;
  rank(request: MatchRequest, candidates: readonly Match[]): readonly Match[];
}

// ── 2. NegotiationRulesProvider ────────────────────────────────────────────

/**
 * Supplies `NegotiationRules` for a given offer. A protocol that supports
 * bargaining registers one of these; the kernel consults it when starting a
 * negotiation.
 */
export interface NegotiationRulesProvider {
  readonly name: string;
  rulesFor(offerId: OfferId): NegotiationRules;
}

// ── 3. QueuePolicyProvider ─────────────────────────────────────────────────

/**
 * Maps a queue name to its `QueueDiscipline`. A protocol that owns work queues
 * (e.g. an SLA-tiered support queue) registers one of these so the kernel
 * picks the right discipline at queue-creation time.
 */
export interface QueuePolicyProvider {
  readonly name: string;
  disciplineFor(queueName: string): QueueDiscipline;
}

// ── 4. ReservationPolicyProvider ───────────────────────────────────────────

/**
 * Caps reservation TTLs. The reservation engine will not issue a reservation
 * with a `ttlMs` greater than `maxTtlMs`; protocols that need different caps
 * register their own provider.
 */
export interface ReservationPolicyProvider {
  readonly name: string;
  readonly maxTtlMs: number;
}

// ── 5. EscalationPolicyProvider ────────────────────────────────────────────

/**
 * Supplies a bundle of `EscalationPolicy` entries. The escalation engine
 * evaluates them in declaration order. Multiple providers' policies are
 * concatenated (provider order = registration order).
 */
export interface EscalationPolicyProvider {
  readonly name: string;
  readonly policies: readonly EscalationPolicy[];
}

// ── 6. OptimizationObjectiveProvider ───────────────────────────────────────

/**
 * Supplies the active `ObjectiveFunction`. The matching engine resolves its
 * `OptimizationEvaluator` by `objective.name` from the OptimizationRegistry
 * (see `optimization.ts`); the provider here simply selects WHICH objective is
 * active for a given request / tenant.
 */
export interface OptimizationObjectiveProvider {
  readonly name: string;
  readonly objective: ObjectiveFunction;
}

// ── 7. CapabilityRanking ───────────────────────────────────────────────────

/**
 * Re-orders a list of capabilities for a given context. A protocol that has
 * domain knowledge about capability quality (e.g. certified vs trainee) can
 * register one of these to influence which capabilities the matching engine
 * considers first.
 */
export interface CapabilityRanking {
  readonly name: string;
  rank(
    capabilities: readonly Capability[],
    context: UnknownRecord
  ): readonly Capability[];
}

// ── 8. AvailabilityModel ───────────────────────────────────────────────────

/**
 * Answers "is `resourceId` available in `window` at time `now`?". The default
 * engine consults `resource.availability` (windows + exclusions); protocols
 * with richer models (e.g. shift schedules, real-time capacity telemetry)
 * install their own.
 */
export interface AvailabilityModel {
  readonly name: string;
  isAvailable(resourceId: ResourceId, window: TemporalWindow, now: number): boolean;
}

// ── Registry bag ───────────────────────────────────────────────────────────

/**
 * A bundle of all 8 protocol-extension ports. The CoordinationKernel carries
 * one of these (built up by the protocol installer) and consults each port as
 * needed. Every field is OPTIONAL — a protocol that doesn't care about, say,
 * negotiation simply omits the provider; the engine then falls back to its
 * built-in default.
 */
export interface ProtocolExtensions {
  readonly matchingStrategies?: readonly MatchingStrategy[];
  readonly negotiationRulesProviders?: readonly NegotiationRulesProvider[];
  readonly queuePolicyProviders?: readonly QueuePolicyProvider[];
  readonly reservationPolicyProviders?: readonly ReservationPolicyProvider[];
  readonly escalationPolicyProviders?: readonly EscalationPolicyProvider[];
  readonly optimizationObjectiveProviders?: readonly OptimizationObjectiveProvider[];
  readonly capabilityRankings?: readonly CapabilityRanking[];
  readonly availabilityModels?: readonly AvailabilityModel[];
}

/**
 * An empty `ProtocolExtensions` — the kernel's default when no protocol has
 * registered anything. Every engine falls back to its built-in behaviour.
 */
export const NO_PROTOCOL_EXTENSIONS: ProtocolExtensions = {};
