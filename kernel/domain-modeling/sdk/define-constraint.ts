/**
 * @kernel/domain-modeling/sdk/define-constraint — `defineConstraint()` DSL.
 *
 * Strongly-typed builder for a `DomainConstraint`.
 */

import type { DomainConstraint } from "../domain/domain-constraint";
import type { ConstraintKind } from "../domain/domain-constraint";

/** Input to `defineConstraint()`. */
export interface DefineConstraintInput {
  readonly id: string;
  readonly kind: ConstraintKind;
  readonly targetEntityType: string;
  readonly attributeRef?: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly description?: string;
}

/** Build a `DomainConstraint`. */
export function defineConstraint(
  input: DefineConstraintInput
): DomainConstraint {
  return {
    id: input.id,
    kind: input.kind,
    targetEntityType: input.targetEntityType,
    attributeRef: input.attributeRef,
    params: input.params,
    description: input.description,
  };
}
