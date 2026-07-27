/**
 * @kernel/policy/domain/policy-engine — the PolicyEngine PORT.
 *
 * The engine is the decision-shaping motor: it holds registered
 * `PolicyDefinition`s, evaluates them against a `PolicyEvaluationContext` in a
 * deterministic order, and produces a `Decision` with provenance. The PURE
 * evaluation core lives in `application/evaluate-policy.ts`; the engine is the
 * I/O-coordinating shell that owns the `PolicyStore` and the optional
 * `ProvenanceRecorder` side-effect.
 *
 * Determinism contract (enforced by the reference implementation in
 * `infrastructure/inMemoryPolicyEngine.ts`):
 *   - `evaluate(ctx, now)` uses ONLY the `now` argument for time — never
 *     `Date.now()`. The caller sources `now` from `ExecutionContext.clock.now()`.
 *   - Evaluation order: candidate policies sorted by `(priority desc, id asc)`;
 *     within each policy, rules sorted by `(priority desc, id asc)`. Ties are
 *     impossible (ids are unique within a policy and policy ids are unique
 *     within a store).
 *   - The `Decision.id` is derived deterministically from the evaluation, so
 *     two identical evaluations produce byte-identical decisions (replay
 *     invariant).
 *   - The optional `ProvenanceRecorder` is the ONLY side-effect; if absent,
 *     evaluation is pure (apart from store reads).
 */

import type { PolicyScope } from "@kernel/shared-kernel";
import type { PolicyDefinition } from "./policy-definition";
import type { PolicyEvaluationContext, Decision } from "./decision";

/**
 * Port: the policy engine.
 *
 * `evaluate(ctx, now)` returns a `Decision` (or a Promise of one — the port
 * permits both sync and async engines; the in-memory reference implementation
 * is synchronous). `now` is the caller-sourced clock time (epoch ms) — the
 * engine MUST NOT call `Date.now()` internally.
 */
export interface PolicyEngine {
  /**
   * Evaluate the registered policies against `ctx` and return a `Decision`.
   *
   * @param ctx   the evaluation context (subject, action, principal, inputs, …)
   * @param now   epoch-ms timestamp sourced from `ExecutionContext.clock.now()`
   */
  evaluate(ctx: PolicyEvaluationContext, now: number): Promise<Decision> | Decision;

  /** Register a policy definition. Idempotent by id — replaces prior entry. */
  register(policy: PolicyDefinition): void;

  /** Unregister a policy by id. No-op if not registered. */
  unregister(policyId: PolicyDefinition["id"]): void;

  /**
   * Snapshot of registered policies, optionally filtered by scope. Returned
   * list is sorted by `(priority desc, id asc)` for deterministic iteration.
   */
  listPolicies(scope?: PolicyScope): readonly PolicyDefinition[];
}
