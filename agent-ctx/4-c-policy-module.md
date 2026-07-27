# Task 4-c — policy-module (agent work record)

## Task
Build the kernel policy module (PredicateSpec evaluator, PolicyDefinition, Rule,
PolicyEngine, Decision, provenance; in-memory engine + store).

## Outcome
COMPLETE. `bunx tsc --noEmit` exits 0; zero errors in `kernel/policy`; zero
errors outside `skills/`. Foundation untouched (no files outside `kernel/policy/`
modified except the worklog append).

## Files produced (13 under `/home/z/my-project/kernel/policy/`)
- `domain/predicate-evaluator.ts` — THE SINGLE SANCTIONED PredicateSpec
  interpreter. Pure + total + fail-closed. Operators: eq, neq, gt, gte, lt, lte,
  in, contains, and, or, not, exists, matches, path. Exports `evaluatePredicate`,
  `getAtPath`, `EVALUATOR_VERSION = 1`.
- `domain/policy-definition.ts` — `PolicyDefinition` (realised, carries full
  `Rule[]`), `PolicyStore` port. Re-exports canonical `Policy`, `Rule`,
  `PolicyScope`, `PolicyEffect`, `PolicyStatus`, `RuleEffect` from shared-kernel.
- `domain/decision.ts` — `PolicyEvaluationContext`, `EvaluationResult`.
  Re-exports canonical `Decision`, `DecisionOutcome`, `DecisionId`.
- `domain/policy-engine.ts` — `PolicyEngine` port.
- `domain/index.ts` — barrel.
- `application/evaluate-policy.ts` — PURE `evaluatePolicy(policy, ctx, now)`:
  per-policy first-match-wins, deterministic `DecisionId`, `hashInputs` via
  `hashSeed(stableStringify(inputs))`. Exports `evaluatePolicy`, `hashInputs`,
  `stableStringify`.
- `application/register-policy.ts` — PURE `registerPolicy(store, policy):
  Result<PolicyDefinition, KernelError>`. Validates version > 0, unique rule
  ids, structurally-valid `PredicateSpec` conditions.
- `application/index.ts` — barrel.
- `infrastructure/in-memory-policy-store.ts` — `InMemoryPolicyStore` (Map-based,
  `list(scope?)` returns fresh array sorted by `(priority desc, id asc)`).
- `infrastructure/in-memory-policy-engine.ts` — `InMemoryPolicyEngine` +
  `InMemoryPolicyEngineDeps`. Holds store + optional `ProvenanceRecorder`.
  Algorithm: active candidates → per-policy `evaluatePolicy` → deny-wins
  combination → build `Decision` → optional provenance record (try/catch-wrapped).
- `infrastructure/index.ts` — barrel.
- `interfaces/index.ts` — public barrel (domain + application + infrastructure).
- `index.ts` — root → `./interfaces`.

## Public surface from `@kernel/policy`
- Evaluator: `evaluatePredicate`, `getAtPath`, `EVALUATOR_VERSION`.
- Definition: `PolicyDefinition`, `PolicyStore` (port).
- Engine: `PolicyEngine` (port).
- Decision: `PolicyEvaluationContext`, `EvaluationResult`.
- Canonical re-exports: `Policy`, `Rule`, `PolicyScope`, `PolicyEffect`,
  `PolicyStatus`, `RuleEffect`, `Decision`, `DecisionOutcome`, `DecisionId`.
- Application: `evaluatePolicy`, `registerPolicy`, `hashInputs`, `stableStringify`.
- Adapters: `InMemoryPolicyStore`, `InMemoryPolicyEngine`,
  `InMemoryPolicyEngineDeps`.

## Key decisions
1. PredicateSpec evaluator is the SINGLE sanctioned interpreter (loud
   box-comment). ADR-0007: rules are serialisable data, never JS functions.
2. Evaluator is TOTAL + FAIL-CLOSED: unknown op / malformed spec / missing path
   / type mismatch / invalid regex → `false`. A broken rule never produces a
   surprise `allow`.
3. `PolicyDefinition` carries full `Rule[]` (not `RuleId[]`) — the canonical
   `Policy` is the transportable shape; `PolicyDefinition` is the evaluable shape.
4. Per-policy first-match-wins (one matched rule per policy); cross-policy
   deny-wins combination (`deny > require-approval > transformed > allow`).
   No match → `deferred`. Policy `effect` field is metadata only (NOT a fallback).
5. `Decision.id` derived deterministically from
   `(correlationId, [policyId,] now, inputHash, matchedRuleIds)` — replay
   produces byte-identical DecisionIds.
6. `hashInputs(inputs)` uses `hashSeed(stableStringify(inputs))` per the task
   spec. `stableStringify` sorts object keys ascending.
7. `Decision.evaluatedAt = now` (caller-sourced from
   `ExecutionContext.clock.now()`). Domain/application NEVER call `Date.now()`.
8. Optional `ProvenanceRecorder` is the ONLY side-effect. Recorder errors are
   caught+swallowed so a faulty recorder cannot break evaluation.
9. `InMemoryPolicyEngine` does NOT import `@kernel/runtime` — `now: number` is
   sourced by the caller. Mirrors the scheduling module's precedent.

## Determinism verified
- Zero `Date.now()`/`new Date()`/`Math.random()`/`setTimeout`/`setInterval`
  actual calls in `kernel/policy/` (only JSDoc mentions).
- Zero module-level mutable state (no top-level `let`/`var`; the single
  `const OUTCOME_PRECEDENCE` is an immutable readonly array).
- All mutable state is instance-scoped inside `InMemoryPolicyStore`/
  `InMemoryPolicyEngine`.
- Only value imports: `asId` + `hashSeed` from shared-kernel + within-module
  application/domain helpers. `ProvenanceRecorder` is type-only.

## Imports verified
- No `@kernel/identity`, `@kernel/organizations`, `@kernel/projections`,
  `@kernel/scheduling`, `@kernel/extension` (only JSDoc mention).
- Only `@kernel/shared-kernel` (type + value) and `@kernel/observability`
  (type-only `ProvenanceRecorder` in infrastructure — allowed per
  dependency-graph.md).
- `@kernel/runtime` referenced only conceptually — `now: number` is passed as
  an argument by the caller.

## tsc result
`cd /home/z/my-project && bunx tsc --noEmit` exits 0.
- `grep "kernel/policy"` → empty.
- `grep -v "skills/" | head` → empty.

This module is now FROZEN for downstream consumers.
