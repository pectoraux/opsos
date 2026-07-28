/**
 * @kernel/policy/application/evaluate-policy — the PURE per-policy evaluation
 * use-case.
 *
 * Given a single `PolicyDefinition`, a `PolicyEvaluationContext`, and a
 * caller-sourced `now` (epoch ms), evaluate the policy's rules against the
 * context's `subject` and return an `EvaluationResult` containing the
 * per-policy `Decision` and the matched `Rule` (if any).
 *
 * PURE:
 *   - No I/O. Does not touch the `PolicyStore` or any `ProvenanceRecorder`.
 *   - No `Date.now()` / `Math.random()`. `now` is passed in.
 *   - `Decision.evaluatedAt` is exactly `now`.
 *   - `Decision.id` is derived deterministically from
 *     `(correlationId, policyId, now, inputHash, matchedRuleIds)` so two
 *     identical evaluations produce byte-identical decisions (replay
 *     invariant).
 *
 * Algorithm (per-policy, first-match-wins within the policy):
 *   1. Filter rules to those whose `scope` matches the policy's scope (a
 *      defensive check — rule scopes are expected to align with the policy).
 *   2. Sort rules by `(priority desc, id asc)`.
 *   3. Iterate in that order; the FIRST rule whose `evaluatePredicate(
 *      rule.condition, ctx.subject)` is `true` is the matched rule.
 *   4. The matched rule's `effect` becomes the policy's outcome (mapped to a
 *      `DecisionOutcome`: `transform` → `transformed`; others pass through).
 *   5. If no rule matches, the outcome is `deferred` (the policy's `effect`
 *      field is metadata only — it describes intent and is NOT used as a
 *      fallback, so every decision has explicit rule-level provenance).
 *
 * The ENGINE (in `infrastructure/`) calls this use-case for each candidate
 * policy and combines the per-policy results with deny-wins precedence
 * (`deny` > `require-approval` > `transform` > `allow`). See
 * `in-memory-policy-engine.ts` for the combination logic.
 */

import {
  asId,
  hashSeed,
} from "@kernel/shared-kernel";
import type {
  DecisionId,
  DecisionOutcome,
  DecisionInput,
  DecisionSubject,
  Rule,
  RuleEffect,
} from "@kernel/shared-kernel";
import type { PolicyDefinition } from "../domain/policy-definition";
import type {
  PolicyEvaluationContext,
  EvaluationResult,
} from "../domain/decision";
import type { Decision } from "../domain/decision";
import { evaluatePredicate, EVALUATOR_VERSION } from "../domain/predicate-evaluator";

/**
 * Map a `RuleEffect` to the `DecisionOutcome` it produces. `transform` →
 * `transformed`; the other three pass through unchanged.
 */
function ruleEffectToOutcome(effect: RuleEffect): DecisionOutcome {
  switch (effect) {
    case "allow":
      return "allow";
    case "deny":
      return "deny";
    case "require-approval":
      return "require-approval";
    case "transform":
      return "transformed";
  }
}

/**
 * Stable stringify — JSON.stringify with object keys sorted ascending. Makes
 * the input hash deterministic regardless of object key insertion order.
 * Handles nested objects and arrays. Cycles are not expected (caller-provided
 * `inputs` should be JSON-transportable); if a cycle is hit, JSON.stringify
 * throws and the caller gets a TypeError — which is the right outcome for
 * non-serialisable inputs (they violate ADR-0007).
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

/**
 * Deterministic hash of `ctx.inputs`. Uses `hashSeed` (xfnv1a → 32-bit) over
 * the stable-stringified inputs. Returned as a hex string for compactness.
 *
 * Two evaluations with the same `inputs` (regardless of key order) produce
 * the same `inputHash`. This is the audit fingerprint of "what was decided
 * about" and is recorded into `Decision.provenance.inputHash`.
 */
export function hashInputs(inputs: Readonly<Record<string, unknown>>): string {
  return hashSeed(stableStringify(inputs)).toString(16);
}

/**
 * Derive a `DecisionSubject` from `ctx.subject`. Looks for `kind` and `id`
 * string fields on the subject record; falls back to `"unknown"` and a
 * stable hash of the subject if absent. This keeps the canonical `Decision`
 * shape populated without coupling the policy module to any domain entity.
 */
function deriveSubject(subject: Readonly<Record<string, unknown>>): DecisionSubject {
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

/**
 * Convert `ctx.inputs` (a record) into the canonical `DecisionInput[]` shape
 * (sorted by name for deterministic ordering).
 */
function toDecisionInputs(inputs: Readonly<Record<string, unknown>>): readonly DecisionInput[] {
  return Object.keys(inputs)
    .sort()
    .map((name) => ({ name, value: inputs[name] }));
}

/**
 * Build a deterministic `DecisionId` from the evaluation inputs. Two
 * identical evaluations produce the same id — this is the replay invariant.
 */
function deriveDecisionId(
  correlationId: string,
  policyId: string,
  now: number,
  inputHash: string,
  matchedRuleIds: readonly string[]
): DecisionId {
  const seed = `${correlationId}|${policyId}|${now}|${inputHash}|${matchedRuleIds.join(",")}`;
  return asId<"DecisionId">(`dec#${hashSeed(seed).toString(16)}`);
}

/**
 * Sort rules by `(priority desc, id asc)`. Pure — returns a new array.
 */
function sortRules(rules: readonly Rule[]): readonly Rule[] {
  return [...rules].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority; // desc
    const aId = String(a.id);
    const bId = String(b.id);
    return aId < bId ? -1 : aId > bId ? 1 : 0; // asc
  });
}

/**
 * Evaluate a single `PolicyDefinition` against `ctx`. PURE.
 *
 * Returns an `EvaluationResult` containing:
 *   - `decision` — the per-policy `Decision` (outcome from the first matched
 *     rule, or `deferred` if no rule matched).
 *   - `matchedRules` — the full `Rule` object that matched (length 0 or 1;
 *     first-match-wins within a policy).
 *
 * This function does NOT touch the `PolicyStore`, the `ProvenanceRecorder`,
 * or any clock. It is safe to call concurrently and replays byte-identically.
 */
export function evaluatePolicy(
  policy: PolicyDefinition,
  ctx: PolicyEvaluationContext,
  now: number
): EvaluationResult {
  const inputHash = hashInputs(ctx.inputs);
  const subject = deriveSubject(ctx.subject);
  const decisionInputs = toDecisionInputs(ctx.inputs);

  const sortedRules = sortRules(policy.rules);
  let matchedRule: Rule | undefined = undefined;
  for (const rule of sortedRules) {
    if (evaluatePredicate(rule.condition, ctx.subject)) {
      matchedRule = rule;
      break;
    }
  }

  if (!matchedRule) {
    // No rule matched → deferred. The policy's `effect` is metadata only and
    // is NOT used as a fallback, so every decision carries explicit
    // rule-level provenance (or none, in the deferred case).
    const decision: Decision = {
      id: deriveDecisionId(ctx.correlationId, String(policy.id), now, inputHash, []),
      decisionType: "policy",
      subject,
      inputs: decisionInputs,
      outcome: "deferred",
      rationale: `Policy '${policy.name}' (${String(policy.id)} v${policy.version}) produced no matching rule; outcome deferred.`,
      matchedRules: [],
      evaluatedAt: now,
      provenance: {
        sourceEventIds: ctx.sourceEventIds,
        inputHash,
      },
    };
    return { decision, matchedRules: [] };
  }

  const outcome = ruleEffectToOutcome(matchedRule.effect);
  const matchedRuleId = String(matchedRule.id);
  const decision: Decision = {
    id: deriveDecisionId(
      ctx.correlationId,
      String(policy.id),
      now,
      inputHash,
      [matchedRuleId]
    ),
    decisionType: "policy",
    subject,
    inputs: decisionInputs,
    outcome,
    rationale: `Policy '${policy.name}' (${String(policy.id)} v${policy.version}) matched rule '${matchedRule.name}' (${matchedRuleId}) with effect '${matchedRule.effect}'; outcome '${outcome}'. [evaluator v${EVALUATOR_VERSION}]`,
    matchedRules: [matchedRule.id],
    evaluatedAt: now,
    provenance: {
      sourceEventIds: ctx.sourceEventIds,
      inputHash,
    },
  };
  return { decision, matchedRules: [matchedRule] };
}
