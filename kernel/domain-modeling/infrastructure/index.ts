/**
 * @kernel/domain-modeling/infrastructure — barrel +
 * `InMemoryDomainModeling` bundle + `createInMemoryDomainModeling()` helper.
 *
 * The infrastructure layer of the Domain Modeling Framework. Concrete
 * in-memory implementations of every port. Pure data structures; no
 * `Date.now()`, no `Math.random()`. Suitable for tests, deterministic
 * replay, and as reference implementations for protocol authors.
 *
 * Public surface:
 *   - InMemoryDomainRegistry       (THE key registry)
 *   - InMemoryEntityRegistry       (runtime entity instances)
 *   - InMemoryDomainModeling (bundle interface)
 *   - createInMemoryDomainModeling() (bundle helper)
 */

import { InMemoryDomainRegistry } from "./in-memory-domain-registry";
import { InMemoryEntityRegistry } from "./in-memory-entity-registry";

export { InMemoryDomainRegistry } from "./in-memory-domain-registry";
export { InMemoryEntityRegistry } from "./in-memory-entity-registry";

import type { DomainDefinition } from "../domain/domain-definition";
import type { EntityInstance } from "../domain/entity-registry";
import type {
  Result,
  KernelError,
} from "@kernel/shared-kernel";

/**
 * A convenience bundle of every in-memory domain-modeling component.
 *
 * Construct one per domain-modeling session and pass the components
 * individually to use-cases (`RegisterDomainUseCase`, `QueryDomainUseCase`,
 * `ValidateEntityUseCase`). The `EntityRegistry` is auto-wired to the
 * `DomainRegistry` for state-machine validation in `transitionState`.
 *
 * Convenience methods (`registerDomain`, `unregisterDomain`, `registerEntity`,
 * `transitionEntityState`) are thin pass-throughs to the underlying
 * registries — they do NOT replace the application use-cases (which provide
 * validation + atomic registration). They exist for ergonomic single-line
 * calls.
 */
export interface InMemoryDomainModeling {
  readonly domains: InMemoryDomainRegistry;
  readonly entities: InMemoryEntityRegistry;

  /** Convenience: registers a domain definition. */
  registerDomain(domain: DomainDefinition): void;
  /** Convenience: unregisters a domain definition. */
  unregisterDomain(domainId: string): void;
  /** Convenience: registers an entity instance. */
  registerEntity(entity: EntityInstance): void;
  /** Convenience: unregisters an entity instance. */
  unregisterEntity(id: string): void;
  /** Convenience: validates + applies a state transition. */
  transitionEntityState(
    id: string,
    to: string,
    now: number
  ): Result<EntityInstance, KernelError>;
}

/**
 * Construct a fresh bundle of in-memory domain-modeling components. Each
 * component is a new instance with empty state. The `EntityRegistry` is
 * wired to the `DomainRegistry` so `transitionState` can validate state
 * transitions against the EntityType's state machine.
 */
export function createInMemoryDomainModeling(): InMemoryDomainModeling {
  const domains = new InMemoryDomainRegistry();
  const entities = new InMemoryEntityRegistry(domains);

  return {
    domains,
    entities,
    registerDomain: (d) => domains.register(d),
    unregisterDomain: (id) => domains.unregister(id),
    registerEntity: (e) => entities.register(e),
    unregisterEntity: (id) => entities.unregister(id),
    transitionEntityState: (id, to, now) =>
      entities.transitionState(id, to, now),
  };
}
