/**
 * @kernel/domain-modeling/sdk/define-domain — `defineDomain()` DSL builder.
 *
 * THE top-level DSL for the Domain Modeling Framework. Returns a fully-formed
 * `DomainDefinition` ready for `DomainRegistry.register`.
 *
 *   export const cleaningDomain = defineDomain({
 *     id: "opsos.domain.cleaning",
 *     name: "cleaning",
 *     version: 1,
 *     entityTypes: [roomType, buildingType, ...],
 *     relationships: [containsRel, locatedInRel, ...],
 *     stateMachines: [roomLifecycleSm, ...],
 *     measurements: [areaDef, ...],
 *     constraints: [roomMustHaveArea, ...],
 *     vocabularyRefs: ["vocab.cleaning-terms"],
 *     taxonomyRefs: ["taxonomy.surface-types"],
 *     ontologyRefs: ["ontology.facilities"],
 *     ownerProtocolId: "opsos.protocol.cleaning.residential",
 *   });
 *
 * All optional arrays default to `[]`. `ownerProtocolId` defaults to
 * `undefined` (a domain MAY be a shared platform definition).
 */

import type { DomainDefinition } from "../domain/domain-definition";
import type { EntityType } from "../domain/entity-type";
import type { RelationshipDefinition } from "../domain/relationship";
import type { StateMachineDefinition } from "../domain/state-machine";
import type { DomainMeasurementDefinition } from "../domain/domain-measurement";
import type { DomainConstraint } from "../domain/domain-constraint";

/** Input to `defineDomain()`. */
export interface DefineDomainInput {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly entityTypes: readonly EntityType[];
  readonly relationships?: readonly RelationshipDefinition[];
  readonly stateMachines?: readonly StateMachineDefinition[];
  readonly measurements?: readonly DomainMeasurementDefinition[];
  readonly constraints?: readonly DomainConstraint[];
  readonly vocabularyRefs?: readonly string[];
  readonly taxonomyRefs?: readonly string[];
  readonly ontologyRefs?: readonly string[];
  readonly ownerProtocolId?: string;
  readonly displayName?: string;
  readonly description?: string;
}

/** Build a `DomainDefinition` from a partial input. */
export function defineDomain(input: DefineDomainInput): DomainDefinition {
  return {
    id: input.id,
    name: input.name,
    version: input.version,
    entityTypes: input.entityTypes,
    relationships: input.relationships ?? [],
    stateMachines: input.stateMachines ?? [],
    measurements: input.measurements ?? [],
    constraints: input.constraints ?? [],
    vocabularyRefs: input.vocabularyRefs ?? [],
    taxonomyRefs: input.taxonomyRefs ?? [],
    ontologyRefs: input.ontologyRefs ?? [],
    ownerProtocolId: input.ownerProtocolId,
    displayName: input.displayName,
    description: input.description,
  };
}
