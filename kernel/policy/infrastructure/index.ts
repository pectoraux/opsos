/**
 * @kernel/policy/infrastructure — barrel.
 *
 * Reference in-memory adapters for the policy module: the Map-based
 * `InMemoryPolicyStore` and the `InMemoryPolicyEngine`. Suitable for kernel
 * self-test, the read-only inspector, and tests. NOT for production
 * persistence (no durability, no caching, no audit-DLQ).
 *
 * The engine is constructed with an optional `InMemoryPolicyStore` (a fresh
 * one is created if omitted) and an optional `ProvenanceRecorder` (the only
 * side-effect of evaluation).
 */
export { InMemoryPolicyStore } from "./in-memory-policy-store";
export {
  InMemoryPolicyEngine,
  type InMemoryPolicyEngineDeps,
} from "./in-memory-policy-engine";
