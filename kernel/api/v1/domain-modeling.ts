/**
 * @kernel/api/v1 — DOMAIN-MODELING public surface (FROZEN).
 *
 * The Domain Modeling Framework: the semantic layer that gives protocols a
 * language to describe reality. OpsOS's equivalent of Kubernetes CRDs for
 * operational businesses. Domain Definition (semantics) is separate from
 * Protocol (behavior) — many protocols share one domain (ADR-0018).
 */

// Domain types
export type {
  AttributeType,
  AttributeDefinition,
  REQUIRED_ATTRIBUTE_FIELDS,
} from "@kernel/domain-modeling";
export type {
  RelationshipKind,
  Cardinality,
  RelationshipDefinition,
} from "@kernel/domain-modeling";
export type {
  EntityType,
  OntologyBinding,
  ResourceBinding,
} from "@kernel/domain-modeling";
export type {
  StateTransition,
  StateMachineDefinition,
} from "@kernel/domain-modeling";
export { canTransitionEntity } from "@kernel/domain-modeling";
export type {
  MeasurementValueType,
  DomainMeasurementDefinition,
} from "@kernel/domain-modeling";
export type {
  ConstraintKind,
  DomainConstraint,
} from "@kernel/domain-modeling";
export type { DomainDefinition } from "@kernel/domain-modeling";

// Ports
export type {
  DomainRegistry,
  EntityTypeFilter,
} from "@kernel/domain-modeling";
export type {
  EntityRegistry,
  EntityInstance,
  EntityQueryFilter,
} from "@kernel/domain-modeling";

// Application
export type {
  RegisterDomain,
  RegisterDomainInput,
  RegisterDomainResult,
  RegisterDomainOutcome,
  RegisterDomainDeps,
  RegisterDomainDiagnostic,
} from "@kernel/domain-modeling";
export { RegisterDomainUseCase } from "@kernel/domain-modeling";

export type {
  QueryDomain,
  QueryDomainInput,
  QueryDomainResult,
  ResolvedEntityType,
} from "@kernel/domain-modeling";
export { QueryDomainUseCase } from "@kernel/domain-modeling";

export type {
  ValidateEntity,
  ValidateEntityInput,
  ValidateEntityResult,
  ValidateEntityDiagnostic,
} from "@kernel/domain-modeling";
export { ValidateEntityUseCase } from "@kernel/domain-modeling";

// Infrastructure
export {
  InMemoryDomainRegistry,
  InMemoryEntityRegistry,
  createInMemoryDomainModeling,
} from "@kernel/domain-modeling";
export type { InMemoryDomainModeling } from "@kernel/domain-modeling";

// DSL
export {
  defineDomain,
  defineEntityType,
  defineAttribute,
  defineRelationship,
  defineStateMachine,
  transition,
  defineMeasurement,
  defineConstraint,
} from "@kernel/domain-modeling";
