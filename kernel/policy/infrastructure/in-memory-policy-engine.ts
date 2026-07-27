/**
 * @kernel/policy/infrastructure/in-memory-policy-engine — reference
 * `PolicyEngine`.
 *
 * Holds an `InMemoryPolicyStore` (+ optional `ProvenanceRecorder`) and
 * implements the deterministic evaluation algorithm:
 *
 *   1. Collect active candidate policies from the store, sorted by
 *      `(priority desc, id asc)` — `store.list()` already returns them in
 *      that order.
 *   2. For each policy, call the PURE `evaluatePolicy(policy, ctx, now)` to
 *      get a per-policy `EvaluationResult` (first-match-wins within the
 *      policy).
 *   3. Collect every per-policy result that produced a match
 *      (`matchedRules.length > 0`).
 *   4. Combine the matched outcomes with deny-wins precedence:
 *        `deny` > `require-approval` > `transformed` > `allow`
 *      If no policy matched, the outcome is `deferred`.
 *   5. Build the final `Decision`:
 *        - `id` derived deterministically from `(correlationId, now,
 *          inputHash, allMatchedRuleIds)` — replay produces byte-identical
 *          DecisionIds.
 *        - `decisionType` = `"policy"`.
 *        - `subject` derived from `ctx.subject` (kind/id fields with safe
 *          fallbacks).
 *        - `inputs` derived from `ctx.inputs` (sorted by name).
 *        - `outcome` = combined outcome.
 *        - `rationale` = human-readable summary.
 *        - `matchedRules` = concat of all matched rule ids across all
 *          matching policies (in policy-priority order, then rule-priority
 *          order).
 *        - `evaluatedAt` = `now` (caller-sourced from
 *          `ExecutionContext.clock.now()` — NEVER `Date.now()`).
 *        - `provenance` = `{ sourceEventIds: ctx.sourceEventIds, inputHash }`.
 *   6. If a `ProvenanceRecorder` was injected, record the decision via
 *      `recorder.recordDecision(...)`. This is the ONLY side-effect.
 *
 * Determinism: no `Date.now()` / `Math.random()`. `now` is the caller's
 * argument. The store iteration order is deterministic. The combination is
 * total and order-independent (deny-wins is a strict precedence). Replays
 * produce byte-identical decisions.
 *
 * Suitable for kernel self-test, the read-only inspector, and tests. NOT for
 * production (no caching, no parallel-evaluation control, no audit-DLQ).
 */

import { asId, hashSeed } from "@kernel/shared-kernel";
import type {
  DecisionId,
  DecisionOutcome,
  DecisionInput,
  DecisionSubject,
  PolicyScope,
  PolicyStatus,
  Rule,
  RuleId,
} from "@kernel/shared-kernel";
import type { ProvenanceRecorder } from "@kernel/observability";
import type { PolicyDefinition } from "../domain/policy-definition";
import type {
  PolicyEvaluationContext,
  Decision,
} from "../domain/decision";
import type { PolicyEngine } from "../domain/policy-engine";
import { InMemoryPolicyStore } from "./in-memory-policy-store";
import {
  evaluatePolicy,
  hashInputs,
  stableStringify,
} from "../application/evaluate-policy";
import { EVALUATOR_VERSION } from "../domain/predicate-evaluator";

/** Constructor deps for `InMemoryPolicyEngine`. */
export interface InMemoryPolicyEngineDeps {
  /**
   * The policy store. If omitted, a fresh `InMemoryPolicyStore` is created
   * and owned by the engine. If supplied, the caller owns the store
   * (typically so it can be inspected or shared).
   */
  readonly store?: InMemoryPolicyStore;
  /**
   * Optional decision-provenance recorder. When present, `evaluate` records
   * every decision via `recorder.recordDecision(...)`. Absent → evaluation
   * is pure (apart from store reads).
   */
  readonly provenance?: ProvenanceRecorder;
}

/**
 * Outcome precedence for deny-wins combination. Lower index = higher
 * precedence. `deferred` is intentionally absent — deferred policies (no
 * match) are excluded from combination.
 */
const OUTCOME_PRECEDENCE: readonly DecisionOutcome[] = [
  "deny",
  "require-approval",
  "transformed",
  "allow",
];

function outcomeRank(o: DecisionOutcome): number {
  const i = OUTCOME_PRECEDENCE.indexOf(o);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

/** Convert `ctx.inputs` (record) → sorted `DecisionInput[]`. */
function toDecisionInputs(
  inputs: Readonly<Record<string, unknown>>
): readonly DecisionInput[] {
  return Object.keys(inputs)
    .sort()
    .map((name) => ({ name, value: inputs[name] }));
}

/** Derive a `DecisionSubject` from `ctx.subject` (kind/id fields with fallbacks). */
function deriveSubject(
  subject: Readonly<Record<string, unknown>>
): DecisionSubject {
  const kind =
    typeof subject.kind === "string"
      ? subject.kind
      : typeof subject.type === "string"
      ? subject.type
      : "unknown";
  const id =
    typeof subject.id === "string"
      ? subject.id
      : hashSeed(stableStringify(subject)).toString(16);
  return { kind, id };
}

/** Build a deterministic `DecisionId` from the combined evaluation. */
function deriveDecisionId(
  correlationId: string,
  now: number,
  inputHash: string,
  matchedRuleIds: readonly string[]
): DecisionId {
  const seed = `${correlationId}|${now}|${inputHash}|${matchedRuleIds.join(",")}`;
  return asId<"DecisionId">(`dec#${hashSeed(seed).toString(16)}`);
}

export class InMemoryPolicyEngine implements PolicyEngine {
  private readonly store: InMemoryPolicyStore;
  private readonly provenance: ProvenanceRecorder | undefined;

  constructor(deps: InMemoryPolicyEngineDeps = {}) {
    this.store = deps.store ?? new InMemoryPolicyStore();
    this.provenance = deps.provenance;
  }

  register(policy: PolicyDefinition): void {
    this.store.register(policy);
  }

  unregister(policyId: PolicyDefinition["id"]): void {
    this.store.unregister(policyId);
  }

  listPolicies(scope?: PolicyScope): readonly PolicyDefinition[] {
    return this.store.list(scope);
  }

  /**
   * Evaluate the registered active policies against `ctx` and return a
   * `Decision`. Synchronous (returns `Decision`, not `Promise<Decision>` —
   * the port permits both).
   *
   * `now` is the caller-sourced clock time (epoch ms) — the engine MUST NOT
   * call `Date.now()`. The caller sources `now` from
   * `ExecutionContext.clock.now()`.
   */
  evaluate(ctx: PolicyEvaluationContext, now: number): Decision {
    const inputHash = hashInputs(ctx.inputs);
    const subject = deriveSubject(ctx.subject);
    const decisionInputs = toDecisionInputs(ctx.inputs);

    // 1. Collect active candidate policies in evaluation order.
    const candidates = this.store
      .list()
      .filter((p) => p.status === ("active" as PolicyStatus));

    // 2. Per-policy evaluation via the PURE use-case. Collect matches.
    const allMatchedRules: Rule[] = [];
    const perPolicyOutcomes: DecisionOutcome[] = [];
    for (const policy of candidates) {
      const result = evaluatePolicy(policy, ctx, now);
      if (result.matchedRules.length > 0) {
        // Per-policy first-match-wins → at most one matched rule per policy.
        const matched = result.matchedRules[0];
        allMatchedRules.push(matched);
        perPolicyOutcomes.push(result.decision.outcome);
      }
    }

    // 3. Combine outcomes with deny-wins precedence.
    let outcome: DecisionOutcome;
    let rationale: string;
    if (perPolicyOutcomes.length === 0) {
      outcome = "deferred";
      rationale = `Evaluated ${candidates.length} active policy(ies); no rule matched; outcome deferred. [evaluator v${EVALUATOR_VERSION}]`;
    } else {
      // deny-wins: the highest-precedence (lowest rank) outcome wins.
      let best = perPolicyOutcomes[0];
      for (let i = 1; i < perPolicyOutcomes.length; i++) {
        if (outcomeRank(perPolicyOutcomes[i]) < outcomeRank(best)) {
          best = perPolicyOutcomes[i];
        }
      }
      outcome = best;
      const matchedIds = allMatchedRules.map((r) => String(r.id));
      rationale = `Evaluated ${candidates.length} active policy(ies); ${perPolicyOutcomes.length} matched (rules: [${matchedIds.join(
        ", "
      )}]); deny-wins outcome '${outcome}'. [evaluator v${EVALUATOR_VERSION}]`;
    }

    // 4. Build the final Decision.
    const matchedRuleIds: readonly RuleId[] = allMatchedRules.map((r) => r.id);
    const decision: Decision = {
      id: deriveDecisionId(
        ctx.correlationId,
        now,
        inputHash,
        matchedRuleIds.map(String)
      ),
      decisionType: "policy",
      subject,
      inputs: decisionInputs,
      outcome,
      rationale,
      matchedRules: matchedRuleIds,
      evaluatedAt: now,
      provenance: {
        sourceEventIds: ctx.sourceEventIds,
        inputHash,
      },
    };

    // 5. Optional provenance recording (the ONLY side-effect).
    if (this.provenance) {
      try {
        this.provenance.recordDecision(
          String(decision.id),
          decision.decisionType,
          ctx.inputs as Record<string, unknown>,
          ctx.sourceEventIds
        );
      } catch {
        // Contain recorder errors — a faulty recorder MUST NOT break
        // evaluation. Production engines route to a DLQ + observability.
      }
    }

    return decision;
  }
}
