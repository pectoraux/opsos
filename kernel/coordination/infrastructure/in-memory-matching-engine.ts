/**
 * @kernel/coordination/infrastructure/in-memory-matching-engine — the
 * in-memory `MatchingEngine` implementation.
 *
 * Pure data structures (arrays + a counter for id minting). No `Date.now()`,
 * no `Math.random()`. All time comes from the request's `now`.
 *
 * Algorithm:
 *   1. Build the candidate set: for each `resource` in `request.resources`,
 *      for each `capability` in `request.capabilities` where
 *      `capability.capabilityType === request.capabilityType` AND
 *      `resource.capabilities.includes(capability.id)` AND
 *      `capability.providerId === resource.id`, emit a `(resource, capability)`
 *      candidate.
 *   2. For each candidate, classify each `request.constraints[i]` as matched
 *      or violated via the built-in `evaluatePredicate` (see below). A
 *      constraint of unknown `kind` defaults to MATCHED (the kernel cannot
 *      interpret protocol-specific constraints; protocols supply their own
 *      evaluators via the extension system).
 *   3. Apply each `request.policies[j]` via the same evaluator:
 *        - `include`  with predicate false → drop candidate.
 *        - `exclude`  with predicate true  → drop candidate.
 *        - `prefer`   with predicate true  → +PREFER_BONUS.
 *        - `penalize` with predicate true  → −PENALIZE_PENALTY.
 *   4. Score = matched*W_match − violated*W_violate + prefer − penalize.
 *   5. Rank by score DESC; ties broken by `resourceId` lexicographic ASC.
 *   6. Top candidate → `selected` (status "selected"); rest → "candidate".
 *   7. Diagnostics: per-candidate one-line summary.
 *
 * The built-in `evaluatePredicate` is a TINY generic evaluator for the
 * structural predicate ops (`eq`, `ne`, `gt`, `lt`, `gte`, `lte`, `in`,
 * `and`, `or`, `not`, `attr-eq`, `attr-ne`, `attr-gt`, `attr-lt`,
 * `capability-has`). Protocol-specific predicates are NOT handled here —
 * they evaluate to `true` (so an unknown `include` keeps the candidate, an
 * unknown `exclude` doesn't drop it). This is the documented fallback.
 */

import { asId } from "@kernel/shared-kernel";
import type {
  Resource,
  Capability,
  Constraint,
  PredicateSpec,
  Match,
  ResourceId,
  CapabilityId,
  DemandId,
  ProvenanceRef,
  UnknownRecord,
} from "@kernel/shared-kernel";
import type {
  MatchRequest,
  MatchResult,
  MatchingEngine,
} from "../domain";
import {
  PREFER_BONUS,
  PENALIZE_PENALTY,
  MATCHED_CONSTRAINT_WEIGHT,
  VIOLATED_CONSTRAINT_PENALTY,
} from "../domain";

/**
 * In-memory `MatchingEngine`. Construct one per coordination session; the
 * internal counter ensures unique `MatchId`s across calls at the same `now`.
 */
export class InMemoryMatchingEngine implements MatchingEngine {
  private counter = 0;

  match(request: MatchRequest): MatchResult {
    const diagnostics: string[] = [];
    const candidates: Match[] = [];

    // ── 1. Build candidate set ───────────────────────────────────────────
    for (const resource of request.resources) {
      for (const capId of resource.capabilities) {
        const capability = request.capabilities.find((c) => c.id === capId);
        if (capability === undefined) continue;
        if (capability.capabilityType !== request.capabilityType) continue;
        if (capability.providerId !== resource.id) continue;

        const candidate = this.scoreCandidate(
          request,
          resource,
          capability
        );
        if (candidate === undefined) continue; // dropped by include/exclude
        candidates.push(candidate);
      }
    }

    diagnostics.push(
      `candidates: ${candidates.length} for capabilityType='${request.capabilityType}'`
    );

    // ── 5. Rank: score DESC, then resourceId ASC (determinism anchor) ─────
    const ranked = [...candidates].sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      // Lexicographic resourceId tie-break (string comparison is total).
      const ra = String(a.resourceId);
      const rb = String(b.resourceId);
      return ra < rb ? -1 : ra > rb ? 1 : 0;
    });

    // Stamp ranks (1-based).
    const withRanks: Match[] = ranked.map((m, idx) => ({
      ...m,
      rank: idx + 1,
    }));

    // ── 6. Select top ────────────────────────────────────────────────────
    const selected = withRanks.length > 0 ? withRanks[0] : undefined;
    const finalMatches: Match[] = selected
      ? withRanks.map((m, idx) =>
          idx === 0 ? { ...m, status: "selected" as const } : m
        )
      : withRanks;

    if (selected) {
      diagnostics.push(
        `selected: resourceId=${selected.resourceId} capabilityId=${selected.capabilityId} score=${selected.score}`
      );
    } else {
      diagnostics.push("selected: <none>");
    }

    return {
      demandId: request.demandId,
      candidates: finalMatches,
      selected: selected
        ? { ...selected, status: "selected" as const }
        : undefined,
      diagnostics,
    };
  }

  // ── Internal: score a single (resource, capability) candidate ──────────
  private scoreCandidate(
    request: MatchRequest,
    resource: Resource,
    capability: Capability
  ): Match | undefined {
    const matched: Constraint[] = [];
    const violated: Constraint[] = [];

    // ── 2. Classify constraints ─────────────────────────────────────────
    for (const constraint of request.constraints) {
      if (this.constraintSatisfied(constraint, resource, capability, request)) {
        matched.push(constraint);
      } else {
        violated.push(constraint);
      }
    }

    // ── 3. Apply policies ───────────────────────────────────────────────
    let preferBonus = 0;
    let penalizeDelta = 0;
    const ctx = this.candidateContext(resource, capability, request);

    for (const policy of request.policies) {
      const holds = this.evaluatePredicate(policy.predicate, ctx);
      switch (policy.effect) {
        case "include":
          if (!holds) return undefined; // drop candidate
          break;
        case "exclude":
          if (holds) return undefined; // drop candidate
          break;
        case "prefer":
          if (holds) preferBonus += PREFER_BONUS;
          break;
        case "penalize":
          if (holds) penalizeDelta -= PENALIZE_PENALTY;
          break;
      }
    }

    const score =
      matched.length * MATCHED_CONSTRAINT_WEIGHT -
      violated.length * VIOLATED_CONSTRAINT_PENALTY +
      preferBonus +
      penalizeDelta;

    return {
      id: this.mintMatchId(request.demandId, resource.id, capability.id),
      demandId: request.demandId,
      resourceId: resource.id,
      capabilityId: capability.id,
      tenantId: request.tenantId,
      score,
      rank: 0, // stamped after sort
      matchedConstraints: matched,
      violatedConstraints: violated,
      status: "candidate",
      computedAt: request.now,
      provenance: this.provenance(),
    };
  }

  // ── Internal: candidate evaluation context ─────────────────────────────
  private candidateContext(
    resource: Resource,
    capability: Capability,
    request: MatchRequest
  ): UnknownRecord {
    return {
      resource,
      capability,
      request,
      attributes: resource.attributes,
      capabilityType: request.capabilityType,
      quantity: request.quantity,
      window: request.window,
    };
  }

  // ── Internal: constraint classification ─────────────────────────────────
  /**
   * A constraint is "satisfied" if its `kind` is recognised by the built-in
   * evaluator AND the corresponding predicate holds. Unknown constraint
   * `kind`s default to SATISFIED (the kernel cannot interpret
   * protocol-specific constraints).
   */
  private constraintSatisfied(
    constraint: Constraint,
    resource: Resource,
    capability: Capability,
    request: MatchRequest
  ): boolean {
    const kind = constraint.kind;
    const params = constraint.params;
    switch (kind) {
      case "attr-eq": {
        const attr = String(params.attr ?? "");
        const val = resource.attributes[attr];
        return val === params.value;
      }
      case "attr-ne": {
        const attr = String(params.attr ?? "");
        const val = resource.attributes[attr];
        return val !== params.value;
      }
      case "attr-gt": {
        const attr = String(params.attr ?? "");
        const val = resource.attributes[attr];
        return typeof val === "number" && val > Number(params.value ?? 0);
      }
      case "attr-lt": {
        const attr = String(params.attr ?? "");
        const val = resource.attributes[attr];
        return typeof val === "number" && val < Number(params.value ?? 0);
      }
      case "capability-has": {
        const capType = String(params.capabilityType ?? "");
        return (
          capType === "" ||
          request.capabilities.some(
            (c) =>
              c.capabilityType === capType &&
              resource.capabilities.includes(c.id)
          )
        );
      }
      case "min-quantity": {
        const requested = request.quantity.amount;
        return resource.capacity.max >= requested;
      }
      case "within-window": {
        const w = params.window as { start: number; end: number } | undefined;
        if (w === undefined) return true;
        return (
          resource.availability.windows.some(
            (aw) => aw.start <= w.start && aw.end >= w.end
          ) &&
          !resource.availability.exclusions.some(
            (xw) => xw.start < w.end && w.start < xw.end
          )
        );
      }
      // Unknown constraint kinds default to satisfied.
      default:
        return true;
    }
  }

  // ── Internal: built-in predicate evaluator ──────────────────────────────
  /**
   * Evaluates a `PredicateSpec` against a context. Recognised ops:
   *   - `eq(a, b)`, `ne(a, b)`, `gt(a, b)`, `lt(a, b)`, `gte(a, b)`, `lte(a, b)`
   *   - `in(value, list)`
   *   - `and(p1, p2, …)`, `or(p1, p2, …)`, `not(p)`
   *   - `attr-eq(name, value)`, `attr-ne(name, value)`,
   *     `attr-gt(name, value)`, `attr-lt(name, value)`
   *   - `capability-has(capabilityType)`
   * Unknown ops evaluate to `true` (the documented fallback).
   */
  private evaluatePredicate(spec: PredicateSpec, ctx: UnknownRecord): boolean {
    const { op, args } = spec;
    switch (op) {
      case "eq":
        return args[0] === args[1];
      case "ne":
        return args[0] !== args[1];
      case "gt":
        return Number(args[0]) > Number(args[1]);
      case "lt":
        return Number(args[0]) < Number(args[1]);
      case "gte":
        return Number(args[0]) >= Number(args[1]);
      case "lte":
        return Number(args[0]) <= Number(args[1]);
      case "in": {
        const list = args[1];
        if (!Array.isArray(list)) return false;
        return list.includes(args[0]);
      }
      case "and":
        return args.every((s) => this.evaluatePredicate(s as PredicateSpec, ctx));
      case "or":
        return args.some((s) => this.evaluatePredicate(s as PredicateSpec, ctx));
      case "not":
        return !this.evaluatePredicate(args[0] as PredicateSpec, ctx);
      case "attr-eq": {
        const name = String(args[0] ?? "");
        const attributes = (ctx.attributes ?? {}) as UnknownRecord;
        return attributes[name] === args[1];
      }
      case "attr-ne": {
        const name = String(args[0] ?? "");
        const attributes = (ctx.attributes ?? {}) as UnknownRecord;
        return attributes[name] !== args[1];
      }
      case "attr-gt": {
        const name = String(args[0] ?? "");
        const attributes = (ctx.attributes ?? {}) as UnknownRecord;
        const v = attributes[name];
        return typeof v === "number" && v > Number(args[1] ?? 0);
      }
      case "attr-lt": {
        const name = String(args[0] ?? "");
        const attributes = (ctx.attributes ?? {}) as UnknownRecord;
        const v = attributes[name];
        return typeof v === "number" && v < Number(args[1] ?? 0);
      }
      case "capability-has": {
        const capType = String(args[0] ?? "");
        if (capType === "") return true;
        const resource = ctx.resource as Resource | undefined;
        if (resource === undefined) return false;
        const capabilities = ctx.capabilities as readonly Capability[] | undefined;
        if (capabilities === undefined) return false;
        return capabilities.some(
          (c) =>
            c.capabilityType === capType &&
            resource.capabilities.includes(c.id)
        );
      }
      default:
        return true;
    }
  }

  // ── Internal: id minting + provenance ───────────────────────────────────
  private mintMatchId(
    demandId: DemandId,
    resourceId: ResourceId,
    capabilityId: CapabilityId
  ): ReturnType<typeof asId<"MatchId">> {
    // Deterministic format: `match#<demandId>#<resourceId>#<capabilityId>`.
    return asId<"MatchId">(
      `match#${demandId}#${resourceId}#${capabilityId}`
    );
  }

  private provenance(): ProvenanceRef {
    return { sourceEventIds: [], inputHash: undefined };
  }
}
