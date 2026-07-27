/**
 * @kernel/organizations/infrastructure/in-memory-organization-repository —
 * reference in-memory OrganizationRepository.
 *
 * Wraps the generic `createEventSourcedRepository` from `@kernel/events` with
 * the Organization reducer, supplying fresh `InMemoryEventStore` /
 * `InMemorySnapshotStore` defaults. Adds `findById` (load + check existence)
 * and `findBySlug` (scan all Organization streams via `readAll()`).
 *
 * Suitable for kernel self-test, the read-only inspector, and tests. NOT for
 * production persistence (that's a future adapter).
 *
 * The `generateEventId` injection point lets deterministic runs (runtime with
 * a seeded RandomSource) replay identically — same seed → same event ids →
 * same envelopes → same replayed state.
 *
 * NOTE on `findBySlug`: it scans all events of `aggregateType === "Organization"`
 * via `EventStore.readAll()` and replays them per stream to compute the current
 * slug. O(n) per call — acceptable for in-memory; a real persisted adapter
 * would maintain a unique-slug index.
 */

import type {
  Result,
  ConcurrencyConflictError,
  OrganizationId,
} from "@kernel/shared-kernel";
import {
  InMemoryEventStore,
  InMemorySnapshotStore,
  createEventSourcedRepository,
  EventSourcedAggregateBase,
} from "@kernel/events";
import type {
  EventStore,
  SnapshotStore,
  AppendResult,
  EventSourcedAggregate,
  EventSourcedRepository,
  EventInput,
  EventEnvelope,
} from "@kernel/events";
import type { OrganizationState } from "../domain/organization";
import type { OrganizationEventPayload } from "../domain/organization-events";
import { organizationReducer } from "../domain/organization";
import type { OrganizationRepository } from "../domain/organization-repository";

/** Constructor deps for `InMemoryOrganizationRepository`. All optional. */
export interface InMemoryOrganizationRepositoryDeps {
  /** Inject a shared EventStore (e.g. the kernel's global store). Defaults to a fresh in-memory one. */
  readonly eventStore?: EventStore;
  /** Inject a shared SnapshotStore. Defaults to a fresh in-memory one. */
  readonly snapshotStore?: SnapshotStore;
  /** Deterministic eventId generator (inject a seeded one for replay). */
  readonly generateEventId?: () => string;
  /** Snapshot every N events (0 = never). Default: 0. */
  readonly snapshotEvery?: number;
}

export class InMemoryOrganizationRepository implements OrganizationRepository {
  private readonly inner: EventSourcedRepository<
    OrganizationState,
    OrganizationEventPayload
  >;
  private readonly eventStore: EventStore;

  constructor(deps: InMemoryOrganizationRepositoryDeps = {}) {
    this.eventStore =
      deps.eventStore ??
      new InMemoryEventStore({
        generateEventId: deps.generateEventId,
      });
    this.inner = createEventSourcedRepository<OrganizationState, OrganizationEventPayload>({
      eventStore: this.eventStore,
      snapshotStore: deps.snapshotStore ?? new InMemorySnapshotStore(),
      reducer: organizationReducer,
      snapshotEvery: deps.snapshotEvery,
    });
  }

  /** The underlying event store (useful for projections / inspection). */
  get store(): EventStore {
    return this.eventStore;
  }

  async load(
    id: OrganizationId | string
  ): Promise<EventSourcedAggregate<OrganizationState, OrganizationEventPayload>> {
    return this.inner.load(id);
  }

  async save(
    aggregate: EventSourcedAggregate<OrganizationState, OrganizationEventPayload>,
    pendingEvents: readonly EventInput<OrganizationEventPayload>[]
  ): Promise<Result<AppendResult, ConcurrencyConflictError>> {
    return this.inner.save(aggregate, pendingEvents);
  }

  async findById(
    id: OrganizationId
  ): Promise<EventSourcedAggregate<OrganizationState, OrganizationEventPayload> | null> {
    const agg = await this.inner.load(id);
    // version 0 = no events on the stream = the org does not exist.
    if (agg.version === 0) return null;
    return agg;
  }

  async findBySlug(
    slug: string
  ): Promise<EventSourcedAggregate<OrganizationState, OrganizationEventPayload> | null> {
    // Scan all Organization events, replay per stream, find the one whose
    // current state.slug matches. O(n) per call.
    const byId = new Map<
      string,
      EventSourcedAggregate<OrganizationState, OrganizationEventPayload>
    >();
    for await (const e of this.eventStore.readAll()) {
      if (e.aggregateType !== "Organization") continue;
      const key = String(e.aggregateId);
      let agg = byId.get(key);
      if (!agg) {
        agg = EventSourcedAggregateBase.fromReducer<
          OrganizationState,
          OrganizationEventPayload
        >(
          organizationReducer,
          e.aggregateId,
          organizationReducer.initialState(e.aggregateId)
        );
        byId.set(key, agg);
      }
      agg.apply(e as EventEnvelope<OrganizationEventPayload>);
    }
    for (const agg of byId.values()) {
      if (agg.version > 0 && agg.state.slug === slug) return agg;
    }
    return null;
  }
}
