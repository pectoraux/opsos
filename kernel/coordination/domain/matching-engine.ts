/**
 * @kernel/coordination/domain/matching-engine — the MatchingEngine PORT.
 *
 * The MatchingEngine is the FIRST engine in the coordination spine: given a
 * `MatchRequest` (a Demand's requirement, the candidate `Resource[]` pool, the
 * registered `Capability[]`, plus protocol-supplied policies), it produces a
 * ranked list of `Match` candidates and (deterministically) selects the top.
 *
 * The engine:
 *   1. Filters `resources` × `capabilities` by `capabilityType` → candidates
 *      (each candidate is a (resource, capability) pair).
 *   2. Evaluates each candidate against the request's `constraints` and
 *      `policies` → classifies matched vs violated constraints, applies
 *      policy effects (include / exclude / prefer / penalize).
 *   3. Scores: per-candidate score =
 *        Σ(matched-constraint weights) − Σ(violated-constraint weights)
 *        + (policy prefer bonus) − (policy penalize penalty)
 *      excluded candidates are dropped; included ones are kept (filter).
 *   4. Ranks by score descending; ties broken by `resourceId` lexicographic
 *      (this is the determinism anchor).
 *   5. Selects the top-ranked candidate as `selected` (status "selected");
 *      the rest remain status "candidate".
 *
 * Determinism rule: this PORT is a pure interface — no `Date.now()`, no
 * `Math.random()`. `now` is supplied by the caller via the request. Concrete
 * implementations (in-memory in `infrastructure/`) MUST honour this.
 */

import type {
  DemandId,
  ResourceId,
  CapabilityId,
  TenantId,
  MatchId,
} from "@kernel/shared-kernel";
import type {
  Constraint,
  Quantity,
  PredicateSpec,
  ObjectiveFunction,
  Resource,
  Capability,
  Match,
} from "@kernel/shared-kernel";
import type { TemporalWindow } from "@kernel/shared-kernel";

/**
 * A request to match a Demand against a resource pool. Pure data.
 *
 * `resources` is the candidate pool (typically pre-filtered to the tenant);
 * `capabilities` is the global capability registry; `policies` are
 * protocol-supplied match policies (include / exclude / prefer / penalize).
 *
 * `optimizationObjective` is OPTIONAL — when absent, the engine falls back to
 * the built-in `kernel.constraint-count` objective (see `optimization.ts`).
 */
export interface MatchRequest {
  readonly demandId: DemandId;
  readonly tenantId: TenantId;
  readonly capabilityType: string;
  readonly quantity: Quantity;
  readonly window: TemporalWindow;
  readonly constraints: readonly Constraint[];
  readonly resources: readonly Resource[];
  readonly capabilities: readonly Capability[];
  readonly policies: readonly MatchPolicy[];
  readonly optimizationObjective?: ObjectiveFunction;
  /** Clock-sourced epoch-millis — supplied by the caller. */
  readonly now: number;
}

/**
 * A single protocol-supplied match policy. The `predicate` is a serialisable
 * `PredicateSpec` (NOT a JS function), so it can be replayed and audited. The
 * engine evaluates the predicate against the candidate's evaluation context
 * (resource + capability + request) and applies the `effect`:
 *
 *   - `include`  → predicate must hold for the candidate to be considered
 *                  (a `false` here drops the candidate outright).
 *   - `exclude`  → predicate must NOT hold (a `true` drops the candidate).
 *   - `prefer`   → predicate-true candidates get a +PREFER_BONUS score bump.
 *   - `penalize` → predicate-true candidates get a −PENALTY score bump.
 */
export interface MatchPolicy {
  readonly name: string;
  readonly predicate: PredicateSpec;
  readonly effect: "include" | "exclude" | "prefer" | "penalize";
}

/**
 * The result of matching: ranked candidates, an optional `selected` (the
 * top-ranked), and a `diagnostics` bag (human-readable trace lines, useful for
 * explaining WHY a particular resource was chosen).
 */
export interface MatchResult {
  readonly demandId: DemandId;
  readonly candidates: readonly Match[];
  readonly selected?: Match;
  readonly diagnostics: readonly string[];
}

/**
 * The MatchingEngine PORT. Implementations MUST be pure functions of
 * `(request) → result`. Identical requests produce identical results.
 */
export interface MatchingEngine {
  match(request: MatchRequest): MatchResult;
}

// ── Engine constants (exported so protocol evaluators can reason about the
//    scoring formula) ──────────────────────────────────────────────────────

/** Bonus added to score when a `prefer` policy's predicate is true. */
export const PREFER_BONUS = 1_000;

/** Penalty subtracted from score when a `penalize` policy's predicate is true. */
export const PENALIZE_PENALTY = 1_000;

/** Weight per matched constraint. */
export const MATCHED_CONSTRAINT_WEIGHT = 100;

/** Penalty per violated constraint. */
export const VIOLATED_CONSTRAINT_PENALTY = 50;

/**
 * A pair of (resource, capability) produced by capability-type filtering.
 * Exposed for protocol-supplied evaluators / tests.
 */
export interface MatchCandidate {
  readonly resource: Resource;
  readonly capability: Capability;
}

/**
 * Construct a `MatchId` deterministically from a request + candidate pair.
 * Exposed so protocol layers can reproduce ids in tests / replay.
 *
 * Format: `match#${demandId}#${resourceId}#${capabilityId}` — this is unique
 * per (demand, resource, capability) triple and stable across replays.
 */
export function computeMatchId(
  demandId: DemandId,
  resourceId: ResourceId,
  capabilityId: CapabilityId
): MatchId {
  // Branded-id construction MUST go through `asId` per the shared-kernel
  // convention. We avoid importing `asId` here to keep the domain layer's
  // dependency surface minimal; the in-memory engine performs the cast.
  return `${demandId}#${resourceId}#${capabilityId}` as unknown as MatchId;
}
