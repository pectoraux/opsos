/**
 * @kernel/domain-modeling/domain — barrel.
 *
 * The domain layer of the Domain Modeling Framework. Pure types + pure
 * interfaces + pure constants + the `canTransitionEntity` pure helper.
 * Depends ONLY on `@kernel/shared-kernel` (and itself).
 *
 * Public surface:
 *   - AttributeType, AttributeDefinition, REQUIRED_ATTRIBUTE_FIELDS
 *   - RelationshipKind, Cardinality, RelationshipDefinition
 *   - EntityType, OntologyBinding, ResourceBinding
 *   - StateTransition, StateMachineDefinition, canTransitionEntity
 *   - MeasurementValueType, DomainMeasurementDefinition
 *   - ConstraintKind, DomainConstraint
 *   - DomainDefinition
 *   - DomainRegistry PORT, EntityTypeFilter
 *   - EntityRegistry PORT, EntityInstance, EntityQueryFilter
 *
 * Layering (ADR-0018):
 *   `Knowledge → Domain Definition → Protocol → Application`
 *
 * Determinism guarantees (enforced):
 *   - NO `Date.now()` / `Math.random()` anywhere in this module.
 *   - All time flows through the `now` argument (used by `transitionState`).
 *   - All registries are pure data structures.
 *   - All query results sorted by id lexicographic ASC.
 */

// ── Attribute ────────────────────────────────────────────────────────────────
export type {
  AttributeType,
  AttributeDefinition,
} from "./attribute";
export { REQUIRED_ATTRIBUTE_FIELDS } from "./attribute";

// ── Relationship ─────────────────────────────────────────────────────────────
export type {
  RelationshipKind,
  Cardinality,
  RelationshipDefinition,
} from "./relationship";

// ── EntityType ───────────────────────────────────────────────────────────────
export type {
  EntityType,
  OntologyBinding,
  ResourceBinding,
} from "./entity-type";

// ── StateMachine ─────────────────────────────────────────────────────────────
export type {
  StateTransition,
  StateMachineDefinition,
} from "./state-machine";
export { canTransitionEntity } from "./state-machine";

// ── Measurement ──────────────────────────────────────────────────────────────
export type {
  MeasurementValueType,
  DomainMeasurementDefinition,
} from "./domain-measurement";

// ── Constraint ───────────────────────────────────────────────────────────────
export type {
  ConstraintKind,
  DomainConstraint,
} from "./domain-constraint";

// ── DomainDefinition (THE aggregate) ─────────────────────────────────────────
export type { DomainDefinition } from "./domain-definition";

// ── DomainRegistry (THE key registry) ────────────────────────────────────────
export type {
  DomainRegistry,
  EntityTypeFilter,
} from "./domain-registry";

// ── EntityRegistry (runtime instances) ───────────────────────────────────────
export type {
  EntityRegistry,
  EntityInstance,
  EntityQueryFilter,
} from "./entity-registry";
