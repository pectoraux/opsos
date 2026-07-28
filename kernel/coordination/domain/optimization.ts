/**
 * @kernel/coordination/domain/optimization — Optimization Objective types.
 *
 * The matching engine ranks candidates against an `OptimizationObjective`,
 * expressed as a serialisable `ObjectiveFunction` (defined in shared-kernel)
 * plus a pure `OptimizationEvaluator` function the caller supplies. This keeps
 * the engine itself objective-agnostic: protocols choose the objective
 * (min-cost, max-utilisation, earliest-deadline, fairness, …) and the kernel
 * applies it deterministically.
 *
 * Determinism rule: an `OptimizationEvaluator` MUST be a pure function of its
 * inputs — same `(objective, context) → score`. It MUST NOT consult the wall
 * clock or call `Math.random()`; the kernel cannot enforce this at the type
 * level, but protocol-supplied evaluators are contractually required to obey.
 */

import type {
  ObjectiveFunction,
  UnknownRecord,
} from "@kernel/shared-kernel";
import type { Match } from "@kernel/shared-kernel";
import type { MatchRequest } from "./matching-engine";

/**
 * The context handed to an `OptimizationEvaluator`. It carries everything a
 * realistic objective might need: the candidate `Match` being scored, the
 * originating `MatchRequest`, and an opaque protocol-supplied `params` bag
 * (typically `objective.params`).
 */
export interface OptimizationContext {
  readonly request: MatchRequest;
  readonly match: Match;
  readonly params: UnknownRecord;
}

/**
 * A pure evaluator: `(objective, context) → score`. Higher = better. The
 * matching engine sorts candidates by score descending; ties are broken by
 * `resourceId` lexicographic order (enforced by the engine, not the evaluator).
 */
export type OptimizationEvaluator = (
  objective: ObjectiveFunction,
  context: OptimizationContext
) => number;

/**
 * A registry mapping objective-function names to their evaluators. Protocols
 * register evaluators at boot; the matching engine looks one up by
 * `objective.name` when the request carries an `optimizationObjective`.
 */
export interface OptimizationRegistry {
  /** Register an evaluator for an objective-function name. */
  register(name: string, evaluator: OptimizationEvaluator): void;
  /** Look up an evaluator, or `undefined` if none registered for `name`. */
  resolve(name: string): OptimizationEvaluator | undefined;
}

/**
 * The default objective used when a request supplies none: pure constraint
 * satisfaction — score = number of matched constraints minus number of
 * violated constraints, plus a tiny constant so non-zero matches sort above
 * zero-match candidates.
 */
export const DEFAULT_OBJECTIVE_NAME = "kernel.constraint-count";

/**
 * Built-in evaluator for the default objective. Pure.
 */
export const constraintCountEvaluator: OptimizationEvaluator = (
  _objective: ObjectiveFunction,
  context: OptimizationContext
): number => {
  const matched = context.match.matchedConstraints.length;
  const violated = context.match.violatedConstraints.length;
  // The +1 baseline ensures that a candidate with all constraints matched
  // outranks one with the same (matched - violated) delta but fewer matches.
  return matched - violated + (matched > 0 ? 1 : 0);
};
