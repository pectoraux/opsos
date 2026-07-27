/**
 * @kernel/protocol-sdk/policy — protocol-declared policies + rules.
 *
 * Wraps the canonical `Policy` / `Rule` primitives with owner-protocol
 * provenance. The policy engine evaluates these at compile time and runtime.
 */

import type {
  PolicyId,
  RuleId,
  PolicyScope,
  PolicyEffect,
  PolicyStatus,
  RuleEffect,
  PredicateSpec,
} from "@kernel/shared-kernel";
import type { SemverString } from "../manifest/protocol-manifest";

export interface ProtocolRule {
  readonly id: RuleId;
  readonly ownerProtocolId: string;
  readonly name: string;
  readonly condition: PredicateSpec;
  readonly effect: RuleEffect;
  readonly priority: number;
  readonly scope: PolicyScope;
  readonly description?: string;
}

export interface ProtocolPolicy {
  readonly id: PolicyId;
  readonly ownerProtocolId: string;
  readonly version: SemverString;
  readonly name: string;
  readonly scope: PolicyScope;
  readonly ruleIds: readonly RuleId[];
  readonly priority: number;
  readonly effect: PolicyEffect;
  readonly status: PolicyStatus;
  readonly description?: string;
}

export interface PolicyContributionRegistry {
  registerPolicy(policy: ProtocolPolicy): void;
  registerRule(rule: ProtocolRule): void;
  unregister(protocolId: string): void;
  getPolicy(id: PolicyId): ProtocolPolicy | undefined;
  getRule(id: RuleId): ProtocolRule | undefined;
  listPolicies(): readonly ProtocolPolicy[];
  listRules(): readonly ProtocolRule[];
  listByProtocol(protocolId: string): { policies: readonly ProtocolPolicy[]; rules: readonly ProtocolRule[] };
}

export class InMemoryPolicyContributionRegistry implements PolicyContributionRegistry {
  private readonly policies = new Map<string, ProtocolPolicy>();
  private readonly rules = new Map<string, ProtocolRule>();

  registerPolicy(p: ProtocolPolicy): void { this.policies.set(String(p.id), p); }
  registerRule(r: ProtocolRule): void { this.rules.set(String(r.id), r); }

  unregister(protocolId: string): void {
    for (const [id, p] of this.policies) if (p.ownerProtocolId === protocolId) this.policies.delete(id);
    for (const [id, r] of this.rules) if (r.ownerProtocolId === protocolId) this.rules.delete(id);
  }

  getPolicy(id: PolicyId): ProtocolPolicy | undefined { return this.policies.get(String(id)); }
  getRule(id: RuleId): ProtocolRule | undefined { return this.rules.get(String(id)); }
  listPolicies(): readonly ProtocolPolicy[] { return Array.from(this.policies.values()); }
  listRules(): readonly ProtocolRule[] { return Array.from(this.rules.values()); }
  listByProtocol(protocolId: string) {
    return {
      policies: this.listPolicies().filter((p) => p.ownerProtocolId === protocolId),
      rules: this.listRules().filter((r) => r.ownerProtocolId === protocolId),
    };
  }
}
