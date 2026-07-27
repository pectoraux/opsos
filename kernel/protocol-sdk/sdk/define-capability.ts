/**
 * @kernel/protocol-sdk/sdk/define-capability — `defineCapability()` DSL.
 *
 * Strongly-typed builder for a `ProtocolCapability`. Provides autocomplete +
 * compile-time validation of the shape.
 */

import type { CapabilityId } from "@kernel/shared-kernel";
import { asId } from "@kernel/shared-kernel";
import type {
  ProtocolCapability,
  CapabilityPort,
  CapabilityRequirement,
  QualityMetric,
  CostModel,
} from "../capabilities/capability-registry";
import type { SemverString } from "../manifest/protocol-manifest";

export interface DefineCapabilityInput {
  readonly id: string;
  readonly capabilityType: string;
  readonly version: SemverString;
  readonly inputs?: readonly CapabilityPort[];
  readonly outputs?: readonly CapabilityPort[];
  readonly requirements?: readonly CapabilityRequirement[];
  readonly qualityMetrics?: readonly QualityMetric[];
  readonly costModel?: CostModel;
  readonly tags?: readonly string[];
  readonly constraints?: readonly import("@kernel/shared-kernel").Constraint[];
  readonly description?: string;
}

/** Build a `ProtocolCapability` from a partial input. `ownerProtocolId` set by the host. */
export function defineCapability(input: DefineCapabilityInput): Omit<ProtocolCapability, "ownerProtocolId"> {
  return {
    id: asId<"CapabilityId">(input.id),
    capabilityType: input.capabilityType,
    version: input.version,
    inputs: input.inputs ?? [],
    outputs: input.outputs ?? [],
    requirements: input.requirements ?? [],
    qualityMetrics: input.qualityMetrics ?? [],
    costModel: input.costModel ?? { model: "free" },
    tags: input.tags ?? [],
    constraints: input.constraints ?? [],
    description: input.description,
  };
}
