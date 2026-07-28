/**
 * @kernel/protocol-sdk/sdk/define-policy — `definePolicy()` + `defineRule()` DSL.
 */

import type { PolicyId, RuleId, PolicyScope, PolicyEffect, PolicyStatus, RuleEffect, PredicateSpec } from "@kernel/shared-kernel";
import { asId } from "@kernel/shared-kernel";
import type { ProtocolPolicy, ProtocolRule } from "../policy/policy-contribution-registry";
import type { SemverString } from "../manifest/protocol-manifest";

export interface DefinePolicyInput {
  readonly id: string;
  readonly version: SemverString;
  readonly name: string;
  readonly scope: PolicyScope;
  readonly ruleIds?: readonly string[];
  readonly priority?: number;
  readonly effect: PolicyEffect;
  readonly status?: PolicyStatus;
  readonly description?: string;
}

export function definePolicy(input: DefinePolicyInput): Omit<ProtocolPolicy, "ownerProtocolId"> {
  return {
    id: asId<"PolicyId">(input.id),
    version: input.version,
    name: input.name,
    scope: input.scope,
    ruleIds: (input.ruleIds ?? []).map((r) => asId<"RuleId">(r)),
    priority: input.priority ?? 0,
    effect: input.effect,
    status: input.status ?? "active",
    description: input.description,
  };
}

export interface DefineRuleInput {
  readonly id: string;
  readonly name: string;
  readonly condition: PredicateSpec;
  readonly effect: RuleEffect;
  readonly priority?: number;
  readonly scope: PolicyScope;
  readonly description?: string;
}

export function defineRule(input: DefineRuleInput): Omit<ProtocolRule, "ownerProtocolId"> {
  return {
    id: asId<"RuleId">(input.id),
    name: input.name,
    condition: input.condition,
    effect: input.effect,
    priority: input.priority ?? 0,
    scope: input.scope,
    description: input.description,
  };
}
