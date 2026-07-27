/**
 * @kernel/api/v1 — POLICY public surface (FROZEN).
 *
 * The decision-shaping engine: serializable predicate evaluation, policy
 * definitions, and the policy engine that produces provenanced decisions.
 */
export type {
  PolicyDefinition,
  PolicyStore,
  PolicyEngine,
  PolicyEvaluationContext,
  EvaluationResult,
} from "@kernel/policy";

// Canonical governance primitives (re-exported for convenience).
export type {
  Policy,
  PolicyScope,
  PolicyEffect,
  PolicyStatus,
  Rule,
  RuleEffect,
  Decision,
  DecisionOutcome,
  DecisionId,
} from "@kernel/policy";

export {
  evaluatePredicate,
  getAtPath,
  EVALUATOR_VERSION,
  evaluatePolicy,
  registerPolicy,
  hashInputs,
  InMemoryPolicyStore,
  InMemoryPolicyEngine,
} from "@kernel/policy";

export type { InMemoryPolicyEngineDeps } from "@kernel/policy";
