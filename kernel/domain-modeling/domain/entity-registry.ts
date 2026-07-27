/**
 * @kernel/domain-modeling/domain/entity-registry — the `EntityRegistry` PORT +
 * the `EntityInstance` runtime record.
 *
 * WHERE `DomainRegistry` holds entity TYPES (definitions), `EntityRegistry`
 * holds entity INSTANCES — the live runtime entities created from those
 * definitions. An entity instance carries:
 *   - its `domainId` + `entityTypeId` (the type it instantiates),
 *   - its `attributes` (validated against the EntityType's
 *     `AttributeDefinition`s),
 *   - its `state` (validated against the EntityType's `StateMachineDefinition`,
 *     if any),
 *   - its `relationships` (relationshipId → target entity ids, validated
 *     against the domain's `RelationshipDefinition`s),
 *   - its `twinId` (when the EntityType has `twinEnabled === true`),
 *   - its `resourceId` (when the entity is bound to a ResourceRecord),
 *   - `createdAt` / `updatedAt` timestamps (caller-supplied epoch-millis —
 *     the registry NEVER calls `Date.now()`).
 *
 * The registry is the SOLE source of truth for entity instances. The
 * compiler, coordination, and resource kernels query it ("give me all
 * entities of type X in domain Y in state Z").
 *
 * The key mutation is `transitionState(id, to, now)`: validates the
 * transition against the EntityType's state machine (via
 * `canTransitionEntity`) and returns a `Result<EntityInstance, KernelError>`.
 * On success, the entity's `state` is updated and `updatedAt` set to `now`.
 * On failure, the entity is unchanged and the result carries the error.
 *
 * Implementations MUST be pure functions of `(entity, …, now)`. No
 * `Date.now()`, no `Math.random()`. All queries return results sorted by id
 * lexicographic ASC (the determinism anchor).
 */

import type { Result, KernelError } from "@kernel/shared-kernel";

/**
 * A runtime entity instance. Created from an `EntityType` definition.
 *
 *   `id`             — unique within the registry.
 *   `domainId`       — the domain the entity belongs to.
 *   `entityTypeId`   — the EntityType id (must exist in the domain).
 *   `attributes`     — the attribute values. Keys match
 *                      `AttributeDefinition.name`s on the EntityType.
 *   `state`          — the current state (must be a state in the EntityType's
 *                      state machine, when one is set). `undefined` when the
 *                      EntityType has no state machine.
 *   `relationships`  — relationshipId → target entity ids. Each key must
 *                      match a `RelationshipDefinition.id` whose
 *                      `sourceEntityType` === this entity's `entityTypeId`.
 *   `twinId`         — when the EntityType has `twinEnabled === true`, the
 *                      TwinId the Twin Kernel assigned.
 *   `resourceId`     — when the entity is bound to a ResourceRecord, the
 *                      ResourceId.
 *   `createdAt`      — caller-supplied epoch-millis.
 *   `updatedAt`      — caller-supplied epoch-millis. Updated on every
 *                      mutation.
 */
export interface EntityInstance {
  readonly id: string;
  readonly domainId: string;
  readonly entityTypeId: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly state?: string;
  readonly relationships: Readonly<Record<string, readonly string[]>>;
  readonly twinId?: string;
  readonly resourceId?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/**
 * Optional filter for `EntityRegistry.query`. All conditions are AND-ed.
 *
 *   `entityTypeId` — when supplied, only entities of this type are returned.
 *   `state`        — when supplied, only entities in this state are returned.
 *   `resourceId`   — when supplied, only entities bound to this resource are
 *                    returned.
 */
export interface EntityQueryFilter {
  readonly entityTypeId?: string;
  readonly state?: string;
  readonly resourceId?: string;
}

/**
 * The EntityRegistry PORT.
 *
 * Implementations MUST be pure functions of `(entity, …, now)`. No
 * `Date.now()`, no `Math.random()`. All queries return results sorted by id
 * lexicographic ASC.
 *
 * `transitionState` is the ONLY mutating method that returns a `Result`; the
 * others either return `void` (mutations) or readonly arrays (queries).
 *
 * The registry implementation validates `transitionState` against the
 * EntityType's state machine by looking up the domain in a sibling
 * `DomainRegistry`. Implementations MUST be constructed with a reference to
 * the `DomainRegistry` they validate against.
 */
export interface EntityRegistry {
  /**
   * Registers (or replaces) an entity instance. The caller is responsible
   * for validating the instance against its EntityType (via the
   * `ValidateEntity` use-case) BEFORE calling this — the registry does NOT
   * re-validate. This keeps register O(1) and lets callers batch-validate.
   */
  register(entity: EntityInstance): void;
  /** Removes the entity. No-op if unknown. */
  unregister(id: string): void;
  /** Returns the entity, or `undefined` if unknown. */
  get(id: string): EntityInstance | undefined;
  /**
   * Returns all entities in `domainId`, sorted by id lexicographic ASC.
   */
  listByDomain(domainId: string): readonly EntityInstance[];
  /**
   * Returns all entities in `domainId` of type `entityTypeId`, sorted by id
   * lexicographic ASC.
   */
  listByType(
    domainId: string,
    entityTypeId: string
  ): readonly EntityInstance[];
  /**
   * Returns all entities in `domainId` matching `filter`, sorted by id
   * lexicographic ASC.
   */
  query(
    domainId: string,
    filter: EntityQueryFilter
  ): readonly EntityInstance[];
  /**
   * Validates and applies a state transition.
   *
   *   - Looks up the entity's EntityType (via the sibling DomainRegistry).
   *   - Looks up the EntityType's state machine.
   *   - If the EntityType has no state machine, returns
   *     `err(IllegalStateError)`.
   *   - If `to` is not a declared state, returns `err(ValidationError)`.
   *   - If `canTransitionEntity(sm, current, to)` is `false`, returns
   *     `err(IllegalStateError)`.
   *   - Otherwise, updates `state` to `to` and `updatedAt` to `now`, and
   *     returns `ok(updatedEntity)`.
   *
   * Returns `err(NotFoundError)` if the entity is unknown.
   */
  transitionState(
    id: string,
    to: string,
    now: number
  ): Result<EntityInstance, KernelError>;
}
