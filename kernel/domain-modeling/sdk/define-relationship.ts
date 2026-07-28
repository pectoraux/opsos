/**
 * @kernel/domain-modeling/sdk/define-relationship — `defineRelationship()` DSL.
 *
 * Strongly-typed builder for a `RelationshipDefinition`.
 */

import type { RelationshipDefinition } from "../domain/relationship";
import type {
  RelationshipKind,
  Cardinality,
} from "../domain/relationship";

/** Input to `defineRelationship()`. */
export interface DefineRelationshipInput {
  readonly id: string;
  readonly name: string;
  readonly sourceEntityType: string;
  readonly targetEntityType: string;
  readonly kind: RelationshipKind;
  readonly cardinality: Cardinality;
  readonly bidirectional: boolean;
  readonly inverseName?: string;
  readonly description?: string;
}

/** Build a `RelationshipDefinition`. */
export function defineRelationship(
  input: DefineRelationshipInput
): RelationshipDefinition {
  return {
    id: input.id,
    name: input.name,
    sourceEntityType: input.sourceEntityType,
    targetEntityType: input.targetEntityType,
    kind: input.kind,
    cardinality: input.cardinality,
    bidirectional: input.bidirectional,
    inverseName: input.inverseName,
    description: input.description,
  };
}
