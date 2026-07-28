/**
 * @kernel/domain-modeling/domain/domain-registry — the `DomainRegistry` PORT.
 *
 * THE key registry of the Domain Modeling Framework. The SOLE source of
 * truth for `DomainDefinition` records. Protocols (or the platform itself)
 * REGISTER domain definitions; the kernel owns their storage, lookup, and
 * cross-domain queries.
 *
 * The registry mirrors the knowledge-kernel's `ownerProtocolId` pattern: a
 * domain definition MAY carry an `ownerProtocolId`; the registry indexes
 * domains by it so a protocol can ask "what domains did I register?" via
 * `listByOwnerProtocol(protocolId)`.
 *
 * Cross-cutting queries:
 *   - `getEntityType(domainId, entityTypeId)` — the most-used lookup. Walks
 *     the domain → entityTypes → match by id. Returns `undefined` if either
 *     the domain or the entity type is unknown.
 *   - `queryEntityTypes(domainId, filter)` — filtered enumeration. Filter by
 *     `resourceType` (matches any `resourceBindings[].resourceType`) and/or
 *     `twinEnabled`. Results sorted by entity type id lexicographic ASC
 *     (the determinism anchor).
 *
 * Implementations MUST be pure functions of `(domain, …)`. No `Date.now()`,
 * no `Math.random()`. Domains are immutable per version; the registry stores
 * the latest version per id.
 */
import type { DomainDefinition } from "./domain-definition";
import type { EntityType } from "./entity-type";

/**
 * Optional filter for `DomainRegistry.queryEntityTypes`. All conditions are
 * AND-ed.
 *
 *   `resourceType`  — when supplied, only entity types whose
 *                     `resourceBindings` contains an entry with this
 *                     `resourceType` are returned.
 *   `twinEnabled`   — when supplied, only entity types whose `twinEnabled`
 *                     matches are returned.
 */
export interface EntityTypeFilter {
  readonly resourceType?: string;
  readonly twinEnabled?: boolean;
}

/**
 * The DomainRegistry PORT.
 *
 * Implementations MUST be pure functions of `(domainId, entityTypeId, …)`.
 * Domains are immutable per version; the registry stores the latest version
 * per id and `get(id)` returns it.
 */
export interface DomainRegistry {
  /**
   * Registers (or replaces) a domain definition. If a domain with the same
   * `id` already exists, it is replaced in place (the new `version` wins).
   * After register, `get(id)` returns the new definition.
   */
  register(domain: DomainDefinition): void;
  /** Removes the domain. No-op if unknown. */
  unregister(domainId: string): void;
  /** Returns the domain, or `undefined` if unknown. */
  get(domainId: string): DomainDefinition | undefined;
  /**
   * Returns all registered domains, sorted by id lexicographic ASC.
   */
  list(): readonly DomainDefinition[];
  /**
   * Returns all domains whose `ownerProtocolId` matches, sorted by id
   * lexicographic ASC. This is how a protocol asks "what domains did I
   * register?".
   */
  listByOwnerProtocol(protocolId: string): readonly DomainDefinition[];
  /**
   * THE most-used lookup. Returns the EntityType with `entityTypeId` in the
   * domain `domainId`, or `undefined` if either is unknown.
   */
  getEntityType(
    domainId: string,
    entityTypeId: string
  ): EntityType | undefined;
  /**
   * Returns all EntityTypes in `domainId` matching `filter`, sorted by id
   * lexicographic ASC. Returns `[]` if the domain is unknown.
   */
  queryEntityTypes(
    domainId: string,
    filter?: EntityTypeFilter
  ): readonly EntityType[];
}
