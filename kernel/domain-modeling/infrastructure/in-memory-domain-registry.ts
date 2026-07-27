/**
 * @kernel/domain-modeling/infrastructure/in-memory-domain-registry — the
 * in-memory `DomainRegistry` implementation. THE key registry.
 *
 * Pure data structures:
 *   - `Map<string, DomainDefinition>` — domainId → definition (last write
 *     wins; the new `version` overwrites the old).
 *   - `Map<string, Set<string>>` — ownerProtocolId → Set<domainId> index.
 *
 *   - `register(domain)` — overwrites any existing entry for `domain.id`;
 *     refreshes the owner-protocol index. Idempotent.
 *   - `unregister(domainId)` — removes the domain + cleans up the index.
 *   - `get(domainId)` — O(1) lookup.
 *   - `list()` — all domains, sorted by id lexicographic ASC.
 *   - `listByOwnerProtocol(protocolId)` — domains whose `ownerProtocolId`
 *     matches, sorted by id lexicographic ASC.
 *   - `getEntityType(domainId, entityTypeId)` — O(1) domain lookup + linear
 *     scan of `entityTypes` for `id === entityTypeId`.
 *   - `queryEntityTypes(domainId, filter)` — filtered enumeration, sorted by
 *     entity type id lexicographic ASC.
 *
 * No `Date.now()`, no `Math.random()`.
 */

import type { DomainDefinition } from "../domain/domain-definition";
import type { EntityType } from "../domain/entity-type";
import type {
  DomainRegistry,
  EntityTypeFilter,
} from "../domain/domain-registry";

export class InMemoryDomainRegistry implements DomainRegistry {
  private readonly domains = new Map<string, DomainDefinition>();
  private readonly byOwner = new Map<string, Set<string>>();

  register(domain: DomainDefinition): void {
    // Refresh owner-protocol index: remove old association if present.
    const existing = this.domains.get(domain.id);
    if (existing && existing.ownerProtocolId) {
      const set = this.byOwner.get(existing.ownerProtocolId);
      if (set) set.delete(domain.id);
    }
    this.domains.set(domain.id, domain);
    if (domain.ownerProtocolId) {
      let set = this.byOwner.get(domain.ownerProtocolId);
      if (!set) {
        set = new Set();
        this.byOwner.set(domain.ownerProtocolId, set);
      }
      set.add(domain.id);
    }
  }

  unregister(domainId: string): void {
    const d = this.domains.get(domainId);
    if (!d) return;
    if (d.ownerProtocolId) {
      const set = this.byOwner.get(d.ownerProtocolId);
      if (set) set.delete(domainId);
    }
    this.domains.delete(domainId);
  }

  get(domainId: string): DomainDefinition | undefined {
    return this.domains.get(domainId);
  }

  list(): readonly DomainDefinition[] {
    const out = Array.from(this.domains.values());
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  listByOwnerProtocol(protocolId: string): readonly DomainDefinition[] {
    const set = this.byOwner.get(protocolId);
    if (!set || set.size === 0) return [];
    const out: DomainDefinition[] = [];
    for (const id of set) {
      const d = this.domains.get(id);
      if (d) out.push(d);
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  getEntityType(
    domainId: string,
    entityTypeId: string
  ): EntityType | undefined {
    const d = this.domains.get(domainId);
    if (!d) return undefined;
    return d.entityTypes.find((et) => et.id === entityTypeId);
  }

  queryEntityTypes(
    domainId: string,
    filter?: EntityTypeFilter
  ): readonly EntityType[] {
    const d = this.domains.get(domainId);
    if (!d) return [];
    const out: EntityType[] = [];
    for (const et of d.entityTypes) {
      if (filter?.resourceType !== undefined) {
        const has = et.resourceBindings.some(
          (rb) => rb.resourceType === filter.resourceType
        );
        if (!has) continue;
      }
      if (filter?.twinEnabled !== undefined) {
        if (et.twinEnabled !== filter.twinEnabled) continue;
      }
      out.push(et);
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }
}
