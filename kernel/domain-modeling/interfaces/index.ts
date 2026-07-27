/**
 * @kernel/domain-modeling — public surface.
 *
 * The Domain Modeling Framework — the semantic layer that gives protocols a
 * language to describe reality. This is OpsOS's equivalent of Kubernetes
 * CRDs: a framework for describing any operational domain WITHOUT
 * hardcoding entity types into the kernel. The kernel never learns what a
 * "room" or "patient" is — the framework lets domains define them.
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
 * Layered dependency direction:
 *   `interfaces/ → application/ → domain/`
 *   `infrastructure/ → application/ → domain/`
 *   `sdk/ → domain/`
 *   `domain/` depends ONLY on `@kernel/shared-kernel`.
 *
 * Public surface:
 *   - Domain types:    AttributeType, AttributeDefinition, RelationshipKind,
 *                      Cardinality, RelationshipDefinition, EntityType,
 *                      OntologyBinding, ResourceBinding, StateTransition,
 *                      StateMachineDefinition, canTransitionEntity,
 *                      MeasurementValueType, DomainMeasurementDefinition,
 *                      ConstraintKind, DomainConstraint, DomainDefinition
 *   - Ports (2):       DomainRegistry (THE key registry), EntityRegistry
 *   - Filter types:    EntityTypeFilter, EntityQueryFilter
 *   - Runtime type:    EntityInstance
 *   - Application:     RegisterDomain + QueryDomain + ValidateEntity use-cases
 *                      (+ UseCase classes + Input/Result/Diagnostic types) +
 *                      toValidationError helper
 *   - Infrastructure:  InMemoryDomainRegistry + InMemoryEntityRegistry +
 *                      InMemoryDomainModeling bundle +
 *                      createInMemoryDomainModeling() helper
 *   - SDK:             defineDomain + defineEntityType + defineAttribute +
 *                      defineRelationship + defineStateMachine +
 *                      defineMeasurement + defineConstraint + transition
 *
 * Determinism guarantees (enforced):
 *   - NO `Date.now()` / `Math.random()` anywhere in this module.
 *   - All time flows through the `now` argument (used by `transitionState`).
 *   - All registries are pure data structures.
 *   - All query results sorted by id lexicographic ASC.
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
export * from "../sdk";
