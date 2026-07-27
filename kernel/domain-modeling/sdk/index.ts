/**
 * @kernel/domain-modeling/sdk — barrel.
 *
 * The DSL builders of the Domain Modeling Framework. Strongly-typed,
 * ergonomic constructors for every domain aggregate. Pure functions; no
 * `Date.now()`, no `Math.random()`.
 *
 * Public surface:
 *   - defineDomain + DefineDomainInput
 *   - defineEntityType + DefineEntityTypeInput
 *   - defineAttribute + DefineAttributeInput
 *   - defineRelationship + DefineRelationshipInput
 *   - defineStateMachine + DefineStateMachineInput + transition helper
 *   - defineMeasurement + DefineMeasurementInput
 *   - defineConstraint + DefineConstraintInput
 */

export type { DefineDomainInput } from "./define-domain";
export { defineDomain } from "./define-domain";

export type { DefineEntityTypeInput } from "./define-entity-type";
export { defineEntityType } from "./define-entity-type";

export type { DefineAttributeInput } from "./define-attribute";
export { defineAttribute } from "./define-attribute";

export type { DefineRelationshipInput } from "./define-relationship";
export { defineRelationship } from "./define-relationship";

export type { DefineStateMachineInput } from "./define-state-machine";
export { defineStateMachine, transition } from "./define-state-machine";

export type { DefineMeasurementInput } from "./define-measurement";
export { defineMeasurement } from "./define-measurement";

export type { DefineConstraintInput } from "./define-constraint";
export { defineConstraint } from "./define-constraint";
