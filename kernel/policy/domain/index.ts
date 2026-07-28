/**
 * @kernel/policy/domain — barrel.
 *
 * The pure domain layer of the policy module: the single sanctioned
 * `PredicateSpec` evaluator, the realized `PolicyDefinition` + `PolicyStore`
 * port, the `PolicyEngine` port, and the decision primitives
 * (`PolicyEvaluationContext`, `EvaluationResult`, re-exported canonical
 * `Decision`/`DecisionOutcome`/`DecisionId`).
 *
 * Depends ONLY on `@kernel/shared-kernel` (type + value imports —
 * `asId`, `hashSeed`, branded ids, `PredicateSpec`, canonical `Decision`/`Rule`).
 * No `Date.now()` / `Math.random()`, no I/O.
 *
 * Public surface (re-exported through `@kernel/policy`):
 *   - `evaluatePredicate`, `getAtPath`, `EVALUATOR_VERSION`
 *   - `PolicyDefinition`, `PolicyStore` (port)
 *   - re-exported canonical: `Policy`, `Rule`, `PolicyScope`, `PolicyEffect`,
 *     `PolicyStatus`, `RuleEffect`
 *   - `PolicyEngine` (port)
 *   - `PolicyEvaluationContext`, `EvaluationResult`
 *   - re-exported canonical: `Decision`, `DecisionOutcome`, `DecisionId`
 */
export * from "./predicate-evaluator";
export * from "./policy-definition";
export * from "./decision";
export * from "./policy-engine";
