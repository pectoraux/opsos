/**
 * @kernel/domain-modeling/application/query-domain — the main query use-case.
 *
 * Other kernels (compiler, coordination, resource, simulation) typically need
 * MORE than one slice of a domain at a time: when planning a task on entity
 * type X, they need the entity type definition, the relationships it
 * participates in, the state machine that governs it, the measurements its
 * attributes reference, AND the constraints that apply to it — all in one
 * round-trip. This use-case bundles those into a single `QueryDomainResult`.
 *
 * The use-case is a thin orchestration layer over the `DomainRegistry`. The
 * registry is the source of truth for query semantics; the use-case is the
 * protocol-facing entry point. It does NOT cache — callers compose caching
 * at a higher layer.
 *
 * Determinism rule: identical inputs + identical registry → identical
 * outputs. No `Date.now()`, no `Math.random()`. All result lists are sorted
 * by id lexicographic ASC (the determinism anchor).
 */

import type { DomainRegistry } from "../domain/domain-registry";
import type { EntityTypeFilter } from "../domain/domain-registry";
import type { EntityType } from "../domain/entity-type";
import type { RelationshipDefinition } from "../domain/relationship";
import type { StateMachineDefinition } from "../domain/state-machine";
import type { DomainMeasurementDefinition } from "../domain/domain-measurement";
import type { DomainConstraint } from "../domain/domain-constraint";
import type { DomainDefinition } from "../domain/domain-definition";

/**
 * The input to `QueryDomain.execute`. Pure data.
 *
 *   `domainId`  — the domain to query. MUST be registered.
 *   `filter`    — optional `EntityTypeFilter` for the `entityTypes` slice.
 *                 When omitted, ALL entity types in the domain are returned.
 */
export interface QueryDomainInput {
  readonly domainId: string;
  readonly filter?: EntityTypeFilter;
}

/**
 * A single entity type resolved with its state machine (when set) and the
 * relationships it participates in. Convenience view — saves callers from
 * re-walking the domain aggregate.
 *
 *   `entityType`     — the EntityType definition.
 *   `stateMachine`   — the resolved `StateMachineDefinition`, when
 *                      `entityType.stateMachineId` is set AND the state
 *                      machine exists in the domain. `undefined` otherwise.
 *   `relationships`  — the `RelationshipDefinition`s this entity type
 *                      participates in (as source OR target), sorted by id
 *                      lexicographic ASC.
 *   `constraints`    — the `DomainConstraint`s targeting this entity type,
 *                      sorted by id lexicographic ASC.
 */
export interface ResolvedEntityType {
  readonly entityType: EntityType;
  readonly stateMachine?: StateMachineDefinition;
  readonly relationships: readonly RelationshipDefinition[];
  readonly constraints: readonly DomainConstraint[];
}

/**
 * The result of `QueryDomain.execute`. A comprehensive domain view.
 */
export interface QueryDomainResult {
  /** The full domain definition, when found. `undefined` otherwise. */
  readonly domain: DomainDefinition | undefined;
  /**
   * Entity types in the domain matching `filter`, sorted by id lexicographic
   * ASC. Empty when the domain is unknown.
   */
  readonly entityTypes: readonly EntityType[];
  /**
   * Resolved entity types (each with its state machine + relationships +
   * constraints), sorted by entity type id lexicographic ASC. Empty when the
   * domain is unknown OR no entity types match the filter.
   */
  readonly resolvedEntityTypes: readonly ResolvedEntityType[];
  /**
   * All relationships in the domain, sorted by id lexicographic ASC. Empty
   * when the domain is unknown.
   */
  readonly relationships: readonly RelationshipDefinition[];
  /**
   * All state machines in the domain, sorted by id lexicographic ASC. Empty
   * when the domain is unknown.
   */
  readonly stateMachines: readonly StateMachineDefinition[];
  /**
   * All measurements in the domain, sorted by metric lexicographic ASC.
   * Empty when the domain is unknown.
   */
  readonly measurements: readonly DomainMeasurementDefinition[];
  /**
   * All constraints in the domain, sorted by id lexicographic ASC. Empty
   * when the domain is unknown.
   */
  readonly constraints: readonly DomainConstraint[];
}

/**
 * The use-case PORT.
 */
export interface QueryDomain {
  execute(input: QueryDomainInput): QueryDomainResult;
}

/**
 * Default implementation.
 */
export class QueryDomainUseCase implements QueryDomain {
  constructor(private readonly registry: DomainRegistry) {}

  execute(input: QueryDomainInput): QueryDomainResult {
    const domain = this.registry.get(input.domainId);
    if (!domain) {
      return EMPTY_RESULT;
    }

    // Entity types (filtered, sorted by id).
    const entityTypes = this.registry
      .queryEntityTypes(input.domainId, input.filter)
      .slice()
      .sort(byIdEntityType);

    // All relationships (sorted by id).
    const relationships = domain.relationships.slice().sort(byIdRelationship);

    // All state machines (sorted by id).
    const stateMachines = domain.stateMachines.slice().sort(byIdStateMachine);

    // All measurements (sorted by metric).
    const measurements = domain.measurements.slice().sort(byMetric);

    // All constraints (sorted by id).
    const constraints = domain.constraints.slice().sort(byIdConstraint);

    // Resolved entity types: each entity type + its state machine +
    // participating relationships + targeting constraints.
    const smById = new Map(stateMachines.map((sm) => [sm.id, sm]));
    const resolvedEntityTypes: ResolvedEntityType[] = entityTypes.map((et) => {
      const sm = et.stateMachineId ? smById.get(et.stateMachineId) : undefined;
      const rels = relationships.filter(
        (r) => r.sourceEntityType === et.id || r.targetEntityType === et.id
      );
      const consts = constraints.filter((c) => c.targetEntityType === et.id);
      return {
        entityType: et,
        stateMachine: sm,
        relationships: rels,
        constraints: consts,
      };
    });

    return {
      domain,
      entityTypes,
      resolvedEntityTypes,
      relationships,
      stateMachines,
      measurements,
      constraints,
    };
  }
}

/** A canonical empty result — returned when the domain is unknown. */
const EMPTY_RESULT: QueryDomainResult = {
  domain: undefined,
  entityTypes: [],
  resolvedEntityTypes: [],
  relationships: [],
  stateMachines: [],
  measurements: [],
  constraints: [],
};

// ── Deterministic comparators ──────────────────────────────────────────────

function byIdEntityType(a: EntityType, b: EntityType): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
function byIdRelationship(a: RelationshipDefinition, b: RelationshipDefinition): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
function byIdStateMachine(a: StateMachineDefinition, b: StateMachineDefinition): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
function byMetric(a: DomainMeasurementDefinition, b: DomainMeasurementDefinition): number {
  return a.metric < b.metric ? -1 : a.metric > b.metric ? 1 : 0;
}
function byIdConstraint(a: DomainConstraint, b: DomainConstraint): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
