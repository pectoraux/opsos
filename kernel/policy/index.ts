/**
 * @kernel/policy — root entry. Re-exports the public interfaces barrel so
 * `import { ... } from "@kernel/policy"` resolves the full policy contract
 * (the decision-shaping engine: PredicateSpec evaluator, PolicyDefinition,
 * Rule, PolicyEngine, Decision, in-memory engine + store).
 */
export * from "./interfaces";
