/**
 * @kernel/protocol-sdk/workflows — protocol-declared workflow templates.
 *
 * A workflow template is a named, ordered sequence of stages with gate rules.
 * The kernel records it; protocols (or applications) compose runtime workflows
 * from templates. No execution logic here.
 */

import type {
  RuleId,
  Constraint,
} from "@kernel/shared-kernel";
import type { SemverString } from "../manifest/protocol-manifest";

export interface WorkflowStageTemplate {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly gateRuleIds: readonly RuleId[];
  readonly constraints: readonly Constraint[];
}

export interface WorkflowTemplate {
  readonly id: string;
  readonly ownerProtocolId: string;
  readonly version: SemverString;
  readonly name: string;
  readonly stages: readonly WorkflowStageTemplate[];
  readonly triggerIntentTypes: readonly string[];
  readonly description?: string;
}

export interface WorkflowRegistry {
  register(template: WorkflowTemplate): void;
  unregister(protocolId: string): void;
  getById(id: string): WorkflowTemplate | undefined;
  list(): readonly WorkflowTemplate[];
  listByProtocol(protocolId: string): readonly WorkflowTemplate[];
  listByTrigger(intentType: string): readonly WorkflowTemplate[];
}

export class InMemoryWorkflowRegistry implements WorkflowRegistry {
  private readonly byId = new Map<string, WorkflowTemplate>();
  register(t: WorkflowTemplate): void { this.byId.set(t.id, t); }
  unregister(protocolId: string): void {
    for (const [id, t] of this.byId) if (t.ownerProtocolId === protocolId) this.byId.delete(id);
  }
  getById(id: string): WorkflowTemplate | undefined { return this.byId.get(id); }
  list(): readonly WorkflowTemplate[] { return Array.from(this.byId.values()); }
  listByProtocol(protocolId: string): readonly WorkflowTemplate[] {
    return this.list().filter((t) => t.ownerProtocolId === protocolId);
  }
  listByTrigger(intentType: string): readonly WorkflowTemplate[] {
    return this.list().filter((t) => t.triggerIntentTypes.includes(intentType));
  }
}
