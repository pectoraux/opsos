/**
 * @kernel/policy/application — barrel.
 *
 * The application layer of the policy module: PURE use-cases that orchestrate
 * the domain ports. No I/O except through the injected `PolicyStore`; no
 * `Date.now()` / `Math.random()`.
 *
 *   - `evaluatePolicy` — the pure per-policy evaluation use-case. Returns an
 *     `EvaluationResult` (per-policy `Decision` + matched `Rule`). The engine
 *     calls this for each candidate policy and combines results with
 *     deny-wins precedence.
 *   - `registerPolicy` — the pure registration command. Validates a
 *     `PolicyDefinition` (version > 0, unique rule ids, valid PredicateSpec
 *     conditions) and registers it with the supplied `PolicyStore`.
 *   - `hashInputs`, `stableStringify` — deterministic input-hashing helpers
 *     used by both `evaluatePolicy` and the engine.
 */
export * from "./evaluate-policy";
export * from "./register-policy";
