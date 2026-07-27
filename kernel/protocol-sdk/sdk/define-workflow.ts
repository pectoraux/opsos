/**
 * @kernel/protocol-sdk/sdk/define-workflow — `defineWorkflow()` DSL.
 */

import type { RuleId, Constraint } from "@kernel/shared-kernel";
import type { WorkflowTemplate, WorkflowStageTemplate } from "../workflows/workflow-registry";
import type { SemverString } from "../manifest/protocol-manifest";

export interface DefineWorkflowStageInput {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly gateRuleIds?: readonly string[];
  readonly constraints?: readonly Constraint[];
}

export interface DefineWorkflowInput {
  readonly id: string;
  readonly version: SemverString;
  readonly name: string;
  readonly stages: readonly DefineWorkflowStageInput[];
  readonly triggerIntentTypes?: readonly string[];
  readonly description?: string;
}

export function defineWorkflow(input: DefineWorkflowInput): Omit<WorkflowTemplate, "ownerProtocolId"> {
  const stages: WorkflowStageTemplate[] = input.stages.map((s) => ({
    id: s.id,
    name: s.name,
    order: s.order,
    gateRuleIds: (s.gateRuleIds ?? []).map((r) => r as RuleId),
    constraints: s.constraints ?? [],
  }));
  return {
    id: input.id,
    version: input.version,
    name: input.name,
    stages,
    triggerIntentTypes: input.triggerIntentTypes ?? [],
    description: input.description,
  };
}
