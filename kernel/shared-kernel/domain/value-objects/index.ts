/**
 * @kernel/shared-kernel — shared value objects.
 *
 * All value objects are immutable and serialisable: no functions, no class
 * instances, no `Date` objects — only epoch numbers and plain data. This is
 * what lets events, projections, and rules be replayed and transported.
 */

import type { TemporalWindow } from "../temporal";

export type UnknownRecord = Readonly<Record<string, unknown>>;
export type UnknownPayload = UnknownRecord;
export type UnknownState = UnknownRecord;
export type AttributeMap = UnknownRecord;

export interface Priority {
  readonly level: number;
  readonly label?: string;
}

export interface Quantity {
  readonly amount: number;
  readonly unit: string;
}

export interface Constraint {
  readonly kind: string;
  readonly params: UnknownRecord;
}

export interface Availability {
  readonly windows: readonly TemporalWindow[];
  readonly exclusions: readonly TemporalWindow[];
}

export interface Capacity {
  readonly max: number;
  readonly unit: string;
  readonly per?: TemporalWindow;
}

/**
 * Serializable predicate DSL. Rules/policies are expressed as PredicateSpec
 * trees, NOT as JS functions, so they replay identically and can be audited /
 * transported as data. A kernel-provided evaluator (in the policy module)
 * interprets these.
 */
export interface PredicateSpec {
  readonly op: string;
  readonly args: readonly unknown[];
}

export interface SchemaRef {
  readonly ref: string;
  readonly version: number;
}

export interface ProvenanceRef {
  readonly sourceEventIds: readonly string[];
  readonly inputHash?: string;
}

export interface ObjectiveFunction {
  readonly name: string;
  readonly params: UnknownRecord;
}

export interface TaskDependency {
  readonly taskId: string;
  readonly relation: "finish-to-start" | "start-to-start" | "finish-to-finish";
}

export interface CapabilityRequirement {
  readonly capabilityType: string;
  readonly quantity: Quantity;
  readonly constraints: readonly Constraint[];
}

export interface WorkflowStage {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly gateRuleIds: readonly string[];
}

export interface WorkflowTrigger {
  readonly kind: string;
  readonly params: UnknownRecord;
}

export interface DecisionInput {
  readonly name: string;
  readonly value: unknown;
}

export interface DecisionSubject {
  readonly kind: string;
  readonly id: string;
}

export interface SimulationInput {
  readonly name: string;
  readonly value: unknown;
}

export interface SimulationOutcome {
  readonly metric: string;
  readonly value: number;
  readonly unit?: string;
}

export interface Assumption {
  readonly name: string;
  readonly description: string;
}

export interface ProposedAction {
  readonly kind: string;
  readonly params: UnknownRecord;
}

export interface RecommendationTarget {
  readonly kind: "intent" | "task" | "plan" | "resource";
  readonly id: string;
}

export type RecommendationSource = "simulation" | "analysis" | "policy";

export interface TransformSpec {
  readonly op: string;
  readonly args: readonly unknown[];
}

export interface ExecutionGraphRef {
  readonly graphId: string;
  readonly version: number;
}
