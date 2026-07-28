/**
 * @kernel/policy/domain/policy-definition — the realized, evaluable form of a
 * Policy + its Rules, plus the `PolicyStore` port.
 *
 * The canonical `Policy` primitive (in `@kernel/shared-kernel/domain/primitives/
 * governance.ts`) carries `rules: readonly RuleId[]` — just the IDs, because
 * the shared-kernel primitive is an abstract, transportable shape. The policy
 * ENGINE, however, needs the actual `Rule` objects (with their `PredicateSpec`
 * conditions) to evaluate. `PolicyDefinition` is that realized, evaluable form.
 *
 * A `PolicyDefinition` is serializable data: every field is JSON-transportable
 * (no functions, no class instances). This is what gets registered, audited,
 * and replayed — never a JS closure.
 *
 * Determinism contract:
 *   - No `Date.now()` / `Math.random()` — definitions are pure data.
 *   - Rule `condition`s are `PredicateSpec`s, evaluated only by the sanctioned
 *     predicate evaluator in `predicate-evaluator.ts`.
 */

import type {
  PolicyId,
  PolicyScope,
  PolicyEffect,
  PolicyStatus,
  Rule,
  RuleEffect,
} from "@kernel/shared-kernel";

// Re-export the canonical governance primitives so consumers can `import
// { Policy, Rule, ... } from "@kernel/policy"` without reaching into
// shared-kernel. The canonical types are the single source of truth.
export type {
  Policy,
  Rule,
  PolicyScope,
  PolicyEffect,
  PolicyStatus,
  RuleEffect,
} from "@kernel/shared-kernel";

/**
 * A realized, evaluable policy. Carries full `Rule` objects (not just
 * `RuleId`s) so the engine can evaluate `rule.condition` directly.
 *
 * `version` is the policy's own schema/version counter — bump it whenever the
 * rules or effect change. Two `PolicyDefinition`s with the same `id` and
 * `version` MUST be byte-identical (this is the replay invariant).
 */
export interface PolicyDefinition {
  /** Canonical policy id (branded `PolicyId`). */
  readonly id: PolicyId;
  /** Schema/version counter. Must be > 0. Same `(id, version)` ⇒ identical. */
  readonly version: number;
  /** Human-readable name. */
  readonly name: string;
  /** Scope at which this policy applies (`tenant`/`organization`/`workflow`/`resource`/`global`). */
  readonly scope: PolicyScope;
  /** The rules in this policy, in declared order. The engine re-sorts by priority at evaluation time. */
  readonly rules: readonly Rule[];
  /** Higher priority = evaluated earlier. Ties broken by `id` ascending. */
  readonly priority: number;
  /** The policy's intent (`allow`/`deny`/`require-approval`). Informational — actual outcomes come from matched rules. */
  readonly effect: PolicyEffect;
  /** Lifecycle status. Only `active` policies are evaluated by the engine. */
  readonly status: PolicyStatus;
}

/**
 * Port: persistence for `PolicyDefinition`s.
 *
 * `register` upserts by `id` (re-registering with the same id replaces the
 * prior definition). `list(scope?)` returns a deterministic, priority-sorted
 * snapshot — implementations MUST NOT return live internal collections.
 *
 * Implementations MUST treat registered `PolicyDefinition` instances as
 * immutable; the caller MUST NOT mutate them after registration.
 */
export interface PolicyStore {
  /** Upsert a policy definition by id. Replaces any prior entry. */
  register(policy: PolicyDefinition): void;
  /** Remove a policy by id. No-op if not registered. */
  unregister(policyId: PolicyId): void;
  /** Fetch a single policy by id, or `undefined` if absent. */
  get(policyId: PolicyId): PolicyDefinition | undefined;
  /**
   * List policies, optionally filtered by scope. Returned list is sorted by
   * `(priority desc, id asc)` for deterministic iteration — the same order
   * the engine uses when evaluating.
   */
  list(scope?: PolicyScope): readonly PolicyDefinition[];
}
