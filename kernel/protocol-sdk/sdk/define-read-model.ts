/**
 * @kernel/protocol-sdk/sdk/define-read-model — `defineReadModel()` DSL.
 */

import type { ProjectionId, SchemaRef } from "@kernel/shared-kernel";
import { asId } from "@kernel/shared-kernel";
import type { ProtocolReadModel } from "../read-models/read-model-registry";
import type { SemverString } from "../manifest/protocol-manifest";

export interface DefineReadModelInput {
  readonly id: string;
  readonly version: SemverString;
  readonly name: string;
  readonly sourceEventTypes: readonly string[];
  readonly targetSchema: SchemaRef;
  /** Opaque ref — resolved to a pure apply function by the host at runtime. */
  readonly transformRef: string;
  readonly description?: string;
}

export function defineReadModel(input: DefineReadModelInput): Omit<ProtocolReadModel, "ownerProtocolId"> {
  return {
    id: asId<"ProjectionId">(input.id),
    version: input.version,
    name: input.name,
    sourceEventTypes: input.sourceEventTypes,
    targetSchema: input.targetSchema,
    transformRef: input.transformRef,
    description: input.description,
  };
}
