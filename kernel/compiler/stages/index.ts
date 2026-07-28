/**
 * @kernel/compiler/stages — barrel + factory for the kernel-provided stages.
 *
 * Each stage is replaceable (ADR-0011). Protocols register additional stages
 * via the extension system; the kernel orchestrates ordering by
 * `(phase, order, name)`. `createDefaultStages(deps)` returns the canonical
 * 9-stage kernel pipeline.
 */

export { NormalizerStage } from "./normalizer";
export { ValidatorStage } from "./validator";
export { PolicyEvaluatorStage } from "./policy-evaluator";
export type { PolicyEvaluatorStageDeps } from "./policy-evaluator";
export { CapabilityResolverStage } from "./capability-resolver";
export { PlannerStage } from "./planner";
export { OptimizerStage } from "./optimizer";
export { SchedulerStage } from "./scheduler-stage";
export type { SchedulerStageDeps } from "./scheduler-stage";
export { RouterStage } from "./router";
export { GraphBuilderStage } from "./graph-builder";

import type { CompilerStage } from "../domain/compiler-stage";
import type { PolicyEvaluatorStageDeps } from "./policy-evaluator";
import type { SchedulerStageDeps } from "./scheduler-stage";
import { NormalizerStage } from "./normalizer";
import { ValidatorStage } from "./validator";
import { PolicyEvaluatorStage } from "./policy-evaluator";
import { CapabilityResolverStage } from "./capability-resolver";
import { PlannerStage } from "./planner";
import { OptimizerStage } from "./optimizer";
import { SchedulerStage } from "./scheduler-stage";
import { RouterStage } from "./router";
import { GraphBuilderStage } from "./graph-builder";

/** Dependencies for the canonical 9-stage kernel pipeline. */
export interface DefaultStagesDeps {
  readonly policyEvaluator: PolicyEvaluatorStageDeps;
  readonly scheduler: SchedulerStageDeps;
}

/**
 * Build the canonical 9-stage kernel compiler pipeline:
 *   Normalizer → Validator → PolicyEvaluator → CapabilityResolver → Planner
 *   → Optimizer → Scheduler → Router → GraphBuilder
 *
 * Each stage uses `order: 10` within its phase; protocol-registered stages may
 * use lower `order` (run before) or higher (run after) within the same phase.
 */
export function createDefaultStages(deps: DefaultStagesDeps): readonly CompilerStage[] {
  return [
    new NormalizerStage(),
    new ValidatorStage(),
    new PolicyEvaluatorStage(deps.policyEvaluator),
    new CapabilityResolverStage(),
    new PlannerStage(),
    new OptimizerStage(),
    new SchedulerStage(deps.scheduler),
    new RouterStage(),
    new GraphBuilderStage(),
  ];
}
