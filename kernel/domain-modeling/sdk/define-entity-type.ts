/**
 * @kernel/domain-modeling/sdk/define-entity-type — `defineEntityType()` DSL.
 *
 * Strongly-typed builder for an `EntityType`. Provides autocomplete + sane
 * defaults (empty arrays, `twinEnabled: false`).
 *
 *   export const roomType = defineEntityType({
 *     id: "room",
 *     name: "room",
 *     attributes: [
 *       defineAttribute({ name: "area", type: "measurement", required: true, measurementMetric: "area" }),
 *     ],
 *     relationships: ["building-contains-room"],
 *     stateMachineId: "room-lifecycle",
 *     twinEnabled: true,
 *   });
 */

import type { EntityType } from "../domain/entity-type";
import type { AttributeDefinition } from "../domain/attribute";
import type { OntologyBinding, ResourceBinding } from "../domain/entity-type";

/** Input to `defineEntityType()`. */
export interface DefineEntityTypeInput {
  readonly id: string;
  readonly name: string;
  readonly attributes: readonly AttributeDefinition[];
  readonly relationships?: readonly string[];
  readonly stateMachineId?: string;
  readonly ontologyBindings?: readonly OntologyBinding[];
  readonly vocabularyRefs?: readonly string[];
  readonly taxonomyRefs?: readonly string[];
  readonly twinEnabled?: boolean;
  readonly resourceBindings?: readonly ResourceBinding[];
  readonly displayName?: string;
  readonly description?: string;
}

/** Build an `EntityType` from a partial input. */
export function defineEntityType(input: DefineEntityTypeInput): EntityType {
  return {
    id: input.id,
    name: input.name,
    attributes: input.attributes,
    relationships: input.relationships ?? [],
    stateMachineId: input.stateMachineId,
    ontologyBindings: input.ontologyBindings ?? [],
    vocabularyRefs: input.vocabularyRefs ?? [],
    taxonomyRefs: input.taxonomyRefs ?? [],
    twinEnabled: input.twinEnabled ?? false,
    resourceBindings: input.resourceBindings ?? [],
    displayName: input.displayName,
    description: input.description,
  };
}
