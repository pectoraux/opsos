/**
 * @kernel/domain-modeling/infrastructure/in-memory-entity-registry — the
 * in-memory `EntityRegistry` implementation.
 *
 * Pure data structures:
 *   - `Map<string, EntityInstance>` — entity id → instance (last write wins).
 *   - `Map<string, Set<string>>` — `${domainId}` → Set<entityId> index.
 *   - `Map<string, Set<string>>` — `${domainId}#${entityTypeId}` → Set<entityId>
 *     composite index for `listByType`.
 *
 *   - `register(entity)` — overwrites any existing entry for `entity.id`;
 *     refreshes both indices. Idempotent.
 *   - `unregister(id)` — removes the entity + cleans up the indices.
 *   - `get(id)` — O(1) lookup.
 *   - `listByDomain(domainId)` — entities in the domain, sorted by id
 *     lexicographic ASC.
 *   - `listByType(domainId, entityTypeId)` — entities of the type, sorted
 *     by id lexicographic ASC.
 *   - `query(domainId, filter)` — filtered enumeration, sorted by id
 *     lexicographic ASC.
 *   - `transitionState(id, to, now)` — validates the transition against the
 *     EntityType's state machine (via the sibling `DomainRegistry`), returns
 *     `Result<EntityInstance, KernelError>`.
 *
 * The registry is constructed with a reference to the `DomainRegistry` it
 * validates state transitions against. This is a runtime dependency — the
 * infrastructure layer MAY import the domain-layer `DomainRegistry` PORT
 * (no cycle: infrastructure → domain → shared-kernel).
 *
 * No `Date.now()`, no `Math.random()`. All time flows through the `now`
 * argument to `transitionState`.
 */

import {
  ok,
  err,
  NotFoundError,
  IllegalStateError,
  ValidationError,
} from "@kernel/shared-kernel";
import type { Result, KernelError } from "@kernel/shared-kernel";
import type { DomainRegistry } from "../domain/domain-registry";
import type {
  EntityRegistry,
  EntityInstance,
  EntityQueryFilter,
} from "../domain/entity-registry";
import { canTransitionEntity } from "../domain/state-machine";

export class InMemoryEntityRegistry implements EntityRegistry {
  private readonly entities = new Map<string, EntityInstance>();
  private readonly byDomain = new Map<string, Set<string>>();
  private readonly byDomainType = new Map<string, Set<string>>();

  constructor(private readonly domains: DomainRegistry) {}

  register(entity: EntityInstance): void {
    this.entities.set(entity.id, entity);
    // Domain index.
    let dSet = this.byDomain.get(entity.domainId);
    if (!dSet) {
      dSet = new Set();
      this.byDomain.set(entity.domainId, dSet);
    }
    dSet.add(entity.id);
    // Domain+type index.
    const dtKey = `${entity.domainId}#${entity.entityTypeId}`;
    let dtSet = this.byDomainType.get(dtKey);
    if (!dtSet) {
      dtSet = new Set();
      this.byDomainType.set(dtKey, dtSet);
    }
    dtSet.add(entity.id);
  }

  unregister(id: string): void {
    const e = this.entities.get(id);
    if (!e) return;
    this.entities.delete(id);
    const dSet = this.byDomain.get(e.domainId);
    if (dSet) dSet.delete(id);
    const dtKey = `${e.domainId}#${e.entityTypeId}`;
    const dtSet = this.byDomainType.get(dtKey);
    if (dtSet) dtSet.delete(id);
  }

  get(id: string): EntityInstance | undefined {
    return this.entities.get(id);
  }

  listByDomain(domainId: string): readonly EntityInstance[] {
    const set = this.byDomain.get(domainId);
    if (!set || set.size === 0) return [];
    const out: EntityInstance[] = [];
    for (const id of set) {
      const e = this.entities.get(id);
      if (e) out.push(e);
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  listByType(
    domainId: string,
    entityTypeId: string
  ): readonly EntityInstance[] {
    const set = this.byDomainType.get(`${domainId}#${entityTypeId}`);
    if (!set || set.size === 0) return [];
    const out: EntityInstance[] = [];
    for (const id of set) {
      const e = this.entities.get(id);
      if (e) out.push(e);
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  query(
    domainId: string,
    filter: EntityQueryFilter
  ): readonly EntityInstance[] {
    // Start from the smallest candidate set: if entityTypeId is supplied,
    // use the domain+type index; else use the domain index.
    let candidates: Set<string> | undefined;
    if (filter.entityTypeId !== undefined) {
      candidates = this.byDomainType.get(
        `${domainId}#${filter.entityTypeId}`
      );
    } else {
      candidates = this.byDomain.get(domainId);
    }
    if (!candidates || candidates.size === 0) return [];
    const out: EntityInstance[] = [];
    for (const id of candidates) {
      const e = this.entities.get(id);
      if (!e) continue;
      if (filter.state !== undefined && e.state !== filter.state) continue;
      if (filter.resourceId !== undefined && e.resourceId !== filter.resourceId)
        continue;
      out.push(e);
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  transitionState(
    id: string,
    to: string,
    now: number
  ): Result<EntityInstance, KernelError> {
    const e = this.entities.get(id);
    if (!e) {
      return err(new NotFoundError("EntityInstance", id));
    }
    // Resolve the EntityType + its state machine.
    const et = this.domains.getEntityType(e.domainId, e.entityTypeId);
    if (!et) {
      return err(
        new NotFoundError(
          "EntityType",
          `${e.domainId}#${e.entityTypeId}`
        )
      );
    }
    if (!et.stateMachineId) {
      return err(
        new IllegalStateError(
          `entity type '${et.id}' has no state machine; cannot transition`
        )
      );
    }
    const domain = this.domains.get(e.domainId);
    const sm = domain?.stateMachines.find((s) => s.id === et.stateMachineId);
    if (!sm) {
      return err(
        new NotFoundError("StateMachineDefinition", et.stateMachineId)
      );
    }
    if (!sm.states.includes(to)) {
      return err(
        new ValidationError(
          `state '${to}' is not in state machine '${sm.id}' (allowed: ${sm.states.join(", ")})`
        )
      );
    }
    const from = e.state ?? sm.initial;
    if (!canTransitionEntity(sm, from, to)) {
      return err(
        new IllegalStateError(
          `illegal transition '${from}' → '${to}' on state machine '${sm.id}'`
        )
      );
    }
    const updated: EntityInstance = {
      ...e,
      state: to,
      updatedAt: now,
    };
    this.entities.set(id, updated);
    return ok(updated);
  }
}
