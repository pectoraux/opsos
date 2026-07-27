/**
 * @kernel/policy/infrastructure/in-memory-policy-store — reference Map-based
 * `PolicyStore`.
 *
 * Holds `PolicyDefinition`s in an instance-scoped `Map` keyed by `String(id)`.
 * Insertion order is preserved by `Map`, but `list(scope?)` returns a FRESH
 * array sorted by `(priority desc, id asc)` so iteration order matches the
 * engine's evaluation order — callers iterating `store.list()` see policies
 * in the same order the engine would evaluate them.
 *
 * Suitable for kernel self-test, the read-only inspector, and tests. NOT for
 * production persistence (no durability, no concurrency control beyond JS's
 * single-threaded execution).
 *
 * Determinism: no `Date.now()` / `Math.random()`. The store is pure data; the
 * sort in `list` is total and stable.
 */

import type { PolicyId, PolicyScope } from "@kernel/shared-kernel";
import type {
  PolicyDefinition,
  PolicyStore,
} from "../domain/policy-definition";

export class InMemoryPolicyStore implements PolicyStore {
  /**
   * Registered definitions keyed by `String(id)`. Insertion order preserved
   * for `get`/`unregister`; `list` re-sorts for deterministic iteration.
   */
  private readonly policies: Map<string, PolicyDefinition> = new Map();

  register(policy: PolicyDefinition): void {
    // Upsert by id — re-registering replaces the prior definition. The
    // stored reference is the caller's; immutability is the caller's contract.
    this.policies.set(String(policy.id), policy);
  }

  unregister(policyId: PolicyId): void {
    this.policies.delete(String(policyId));
  }

  get(policyId: PolicyId): PolicyDefinition | undefined {
    return this.policies.get(String(policyId));
  }

  list(scope?: PolicyScope): readonly PolicyDefinition[] {
    const all = Array.from(this.policies.values());
    const filtered =
      scope === undefined ? all : all.filter((p) => p.scope === scope);
    // Sort by (priority desc, id asc) for deterministic, evaluation-order
    // iteration. Stable sort preserves insertion order within a tie — though
    // ties on `(priority, id)` are impossible because ids are unique keys.
    return filtered.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      const aId = String(a.id);
      const bId = String(b.id);
      return aId < bId ? -1 : aId > bId ? 1 : 0;
    });
  }
}
