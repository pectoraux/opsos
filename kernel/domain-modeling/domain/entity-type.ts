/**
 * @kernel/domain-modeling/domain/entity-type — `EntityType`.
 *
 * An EntityType is a typed "class" of entity within a domain. It carries:
 *   - the attributes that shape its data (typed slots),
 *   - the relationships it participates in (typed edges),
 *   - the state machine that governs its lifecycle (optional),
 *   - the ontology / taxonomy / vocabulary it binds to (knowledge refs),
 *   - whether digital-twin tracking is enabled,
 *   - the resource bindings it exposes (resource-type → optional capability
 *     type — i.e. an EntityType of this kind can be backed by a ResourceRecord
 *     of `resourceType`, optionally requiring a Capability of
 *     `capabilityType`).
 *
 * The kernel never learns what "Room" or "Patient" is. A domain definition
 * DECLARES these via `EntityType`s; protocols build ON TOP of the domain.
 *
 * Per ADR-0018, MANY protocols can share ONE domain definition. Residential,
 * commercial, hospital, and industrial cleaning protocols ALL share the
 * generic Cleaning Domain — they bring different BEHAVIOURS (compiler
 * extensions, coordination strategies, workflows, policies) but share the
 * same SEMANTICS (entity types, relationships, state machines).
 *
 * Determinism: pure data. No `Date.now()`, no `Math.random()`.
 */

import type { AttributeDefinition } from "./attribute";

/**
 * An ontology binding — links this EntityType to a node in a registered
 * Ontology (knowledge layer). The `nodeId` is optional: an EntityType may
 * bind to an entire ontology (e.g. for vocabulary alignment) rather than a
 * specific node.
 */
export interface OntologyBinding {
  readonly ontologyId: string;
  readonly nodeId?: string;
}

/**
 * A resource binding — declares that an EntityType of this kind can be backed
 * by a `ResourceRecord` of `resourceType`, optionally requiring the resource
 * to expose a `Capability` of `capabilityType`.
 *
 *   `resourceType`    — the resource-type string (matches
 *                       `ResourceRecord.resourceType`).
 *   `capabilityType`  — optional capability-type string (matches
 *                       `Capability.capabilityType`). When set, only resources
 *                       with a capability of this type may back entities of
 *                       this EntityType.
 */
export interface ResourceBinding {
  readonly resourceType: string;
  readonly capabilityType?: string;
}

/**
 * An EntityType — a typed class of entity within a domain.
 *
 *   `id`                — unique within the domain.
 *   `name`              — machine name (e.g. "room", "patient"). MUST be
 *                         unique within the domain. NOT a kernel-reserved
 *                         word — the kernel never inspects the name.
 *   `displayName`       — optional human-readable name.
 *   `attributes`        — the typed attribute slots.
 *   `relationships`     — the ids of `RelationshipDefinition`s this entity
 *                         type participates in (as source OR target).
 *   `stateMachineId`    — optional id of the `StateMachineDefinition` that
 *                         governs this entity type's lifecycle.
 *   `ontologyBindings`  — links to registered Ontologies (knowledge layer).
 *   `vocabularyRefs`    — links to registered Vocabularies (knowledge layer).
 *   `taxonomyRefs`      — links to registered Taxonomies (knowledge layer).
 *   `twinEnabled`       — whether digital-twin tracking is enabled for this
 *                         entity type. When `true`, the Twin Kernel tracks
 *                         live state for each entity instance.
 *   `resourceBindings`  — declares which ResourceRecord types may back
 *                         instances of this EntityType.
 *   `description`       — optional human-readable description.
 */
export interface EntityType {
  readonly id: string;
  readonly name: string;
  readonly displayName?: string;
  readonly attributes: readonly AttributeDefinition[];
  readonly relationships: readonly string[];
  readonly stateMachineId?: string;
  readonly ontologyBindings: readonly OntologyBinding[];
  readonly vocabularyRefs: readonly string[];
  readonly taxonomyRefs: readonly string[];
  readonly twinEnabled: boolean;
  readonly resourceBindings: readonly ResourceBinding[];
  readonly description?: string;
}
