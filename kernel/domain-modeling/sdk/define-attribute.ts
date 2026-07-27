/**
 * @kernel/domain-modeling/sdk/define-attribute — `defineAttribute()` DSL.
 *
 * Strongly-typed builder for an `AttributeDefinition`. Provides autocomplete
 * + compile-time validation of the shape.
 *
 * Used internally by `defineEntityType()` — not exported from the SDK barrel
 * (attribute definitions are passed inline to `defineEntityType`), but
 * exported from this file so protocol authors who build entity types
 * programmatically can use it.
 */

import type { AttributeDefinition, AttributeType } from "../domain/attribute";

/** Input to `defineAttribute()`. */
export interface DefineAttributeInput {
  readonly name: string;
  readonly type: AttributeType;
  readonly required?: boolean;
  readonly default?: unknown;
  readonly enumValues?: readonly string[];
  readonly measurementMetric?: string;
  readonly referenceEntityType?: string;
  readonly resourceType?: string;
  readonly knowledgeItemKind?: string;
  readonly capabilityType?: string;
  readonly description?: string;
}

/** Build an `AttributeDefinition` from a partial input. */
export function defineAttribute(input: DefineAttributeInput): AttributeDefinition {
  return {
    name: input.name,
    type: input.type,
    required: input.required ?? false,
    default: input.default,
    enumValues: input.enumValues,
    measurementMetric: input.measurementMetric,
    referenceEntityType: input.referenceEntityType,
    resourceType: input.resourceType,
    knowledgeItemKind: input.knowledgeItemKind,
    capabilityType: input.capabilityType,
    description: input.description,
  };
}
