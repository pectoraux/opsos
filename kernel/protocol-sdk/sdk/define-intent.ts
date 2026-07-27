/**
 * @kernel/protocol-sdk/sdk/define-intent — `defineIntent()` DSL.
 */

import type { SchemaRef, Constraint, PredicateSpec, PolicyEffect, CapabilityRequirement } from "@kernel/shared-kernel";
import type { ProtocolIntentType, IntentDefaultPolicy, CompilerHook } from "../intents/intent-registry";
import type { SemverString } from "../manifest/protocol-manifest";

export interface DefineIntentInput {
  readonly intentType: string;
  readonly version: SemverString;
  readonly payloadSchema: SchemaRef;
  readonly validation?: readonly Constraint[];
  readonly defaultPolicies?: readonly IntentDefaultPolicy[];
  readonly compilerHooks?: readonly CompilerHook[];
  readonly requiredCapabilities?: readonly CapabilityRequirement[];
  readonly description?: string;
}

export function defineIntent(input: DefineIntentInput): Omit<ProtocolIntentType, "ownerProtocolId"> {
  return {
    intentType: input.intentType,
    version: input.version,
    payloadSchema: input.payloadSchema,
    validation: input.validation ?? [],
    defaultPolicies: input.defaultPolicies ?? [],
    compilerHooks: input.compilerHooks ?? [],
    requiredCapabilities: input.requiredCapabilities ?? [],
    description: input.description,
  };
}
