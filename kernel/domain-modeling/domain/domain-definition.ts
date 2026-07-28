/**
 * @kernel/domain-modeling/domain/domain-definition — `DomainDefinition`,
 * THE top-level aggregate of the Domain Modeling Framework.
 *
 * A `DomainDefinition` is the semantic layer that gives protocols a language
 * to describe reality. It is OpsOS's equivalent of Kubernetes CRDs: a
 * framework for describing any operational domain WITHOUT hardcoding entity
 * types into the kernel. The kernel never learns what a "room" or "patient"
 * is — a domain definition DECLARES them.
 *
 * Per ADR-0018, the kernel introduces a critical architectural separation:
 *
 *   Domain Definition (semantics) ── entity types, relationships, state
 *                                    machines, measurements, constraints,
 *                                    vocabulary, ontology bindings.
 *   Protocol        (behaviour)  ── compiler extensions, coordination
 *                                    strategies, policies, workflows, UI.
 *
 * MANY protocols can share ONE domain definition. Residential, commercial,
 * hospital, and industrial cleaning protocols ALL share the generic Cleaning
 * Domain — they bring different BEHAVIOURS but share the same SEMANTICS.
 *
 * The layering is: `Knowledge → Domain Definition → Protocol → Application`.
 *
 *   `ownerProtocolId` is OPTIONAL — a domain definition MAY be owned by a
 *   single protocol (the protocol that registers it), or it MAY be a shared
 *   definition registered by the platform itself. When `ownerProtocolId` is
 *   set, `DomainRegistry.listByOwnerProtocol(protocolId)` returns it; this is
 *   how a protocol asks "what domains did I register?" (mirrors the
 *   knowledge-kernel's `ownerProtocolId` pattern).
 *
 * Determinism: pure data. No `Date.now()`, no `Math.random()`. All children
 * are immutable, readonly arrays. The aggregate is fully serialisable.
 */

import type { EntityType } from "./entity-type";
import type { RelationshipDefinition } from "./relationship";
import type { StateMachineDefinition } from "./state-machine";
import type { DomainMeasurementDefinition } from "./domain-measurement";
import type { DomainConstraint } from "./domain-constraint";

/**
 * A DomainDefinition — THE top-level aggregate of the Domain Modeling
 * Framework.
 *
 *   `id`              — namespaced domain id, e.g. "opsos.domain.cleaning".
 *   `name`            — machine name / slug.
 *   `version`         — integer version of this definition.
 *   `displayName`     — optional human-readable name.
 *   `description`     — optional human-readable description.
 *   `entityTypes`     — the typed classes of entity in this domain.
 *   `relationships`   — the typed edges between entity types.
 *   `stateMachines`   — the lifecycle graphs entity types may reference.
 *   `measurements`    — the typed measurement definitions.
 *   `constraints`     — the declarative, serialisable constraints.
 *   `vocabularyRefs`  — links to registered Vocabularies (knowledge layer).
 *   `taxonomyRefs`    — links to registered Taxonomies (knowledge layer).
 *   `ontologyRefs`    — links to registered Ontologies (knowledge layer).
 *   `ownerProtocolId` — OPTIONAL. When set, the protocol that registered this
 *                       domain. `DomainRegistry.listByOwnerProtocol` uses it.
 */
export interface DomainDefinition {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly displayName?: string;
  readonly description?: string;
  readonly entityTypes: readonly EntityType[];
  readonly relationships: readonly RelationshipDefinition[];
  readonly stateMachines: readonly StateMachineDefinition[];
  readonly measurements: readonly DomainMeasurementDefinition[];
  readonly constraints: readonly DomainConstraint[];
  readonly vocabularyRefs: readonly string[];
  readonly taxonomyRefs: readonly string[];
  readonly ontologyRefs: readonly string[];
  readonly ownerProtocolId?: string;
}
