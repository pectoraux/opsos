/**
 * @kernel/organizations/infrastructure/in-memory-membership-repository —
 * reference in-memory MembershipRepository.
 *
 * Wraps the generic `createEventSourcedRepository` from `@kernel/events` with
 * the Membership reducer, supplying fresh `InMemoryEventStore` /
 * `InMemorySnapshotStore` defaults. Adds:
 *   - `findById`            — load by composite id; null if stream empty.
 *   - `findByOrgAndUser`    — compute composite id, delegate to `findById`.
 *   - `listByOrganization`  — scan all Membership streams via `readAll()`,
 *                             replay per stream, filter by `organizationId`.
 *
 * Suitable for kernel self-test, the read-only inspector, and tests. NOT for
 * production persistence.
 *
 * The `generateEventId` injection point lets deterministic runs replay
 * identically (same seed → same event ids → same envelopes → same state).
 *
 * NOTE on `listByOrganization`: O(n) scan of all Membership events per call —
 * acceptable for in-memory; a real persisted adapter would maintain a per-org
 * index.
 */

import type {
  Result,
  ConcurrencyConflictError,
  OrganizationId,
  UserId,
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
import type { MembershipState } from "../domain/membership";
import type { MembershipEventPayload } from "../domain/membership-events";
import { membershipIdOf } from "../domain/membership-events";
import { membershipReducer } from "../domain/membership";
import type { MembershipRepository } from "../domain/membership-repository";

/** Constructor deps for `InMemoryMembershipRepository`. All optional. */
export interface InMemoryMembershipRepositoryDeps {
  /** Inject a shared EventStore (e.g. the kernel's global store). Defaults to a fresh in-memory one. */
  readonly eventStore?: EventStore;
  /** Inject a shared SnapshotStore. Defaults to a fresh in-memory one. */
  readonly snapshotStore?: SnapshotStore;
  /** Deterministic eventId generator (inject a seeded one for replay). */
  readonly generateEventId?: () => string;
  /** Snapshot every N events (0 = never). Default: 0. */
  readonly snapshotEvery?: number;
}

export class InMemoryMembershipRepository implements MembershipRepository {
  private readonly inner: EventSourcedRepository<
    MembershipState,
    MembershipEventPayload
  >;
  private readonly eventStore: EventStore;

  constructor(deps: InMemoryMembershipRepositoryDeps = {}) {
    this.eventStore =
      deps.eventStore ??
      new InMemoryEventStore({
        generateEventId: deps.generateEventId,
      });
    this.inner = createEventSourcedRepository<MembershipState, MembershipEventPayload>({
      eventStore: this.eventStore,
      snapshotStore: deps.snapshotStore ?? new InMemorySnapshotStore(),
      reducer: membershipReducer,
      snapshotEvery: deps.snapshotEvery,
    });
  }

  /** The underlying event store (useful for projections / inspection). */
  get store(): EventStore {
    return this.eventStore;
  }

  async load(
    id: string
  ): Promise<EventSourcedAggregate<MembershipState, MembershipEventPayload>> {
    return this.inner.load(id);
  }

  async save(
    aggregate: EventSourcedAggregate<MembershipState, MembershipEventPayload>,
    pendingEvents: readonly EventInput<MembershipEventPayload>[]
  ): Promise<Result<AppendResult, ConcurrencyConflictError>> {
    return this.inner.save(aggregate, pendingEvents);
  }

  async findById(
    id: string
  ): Promise<EventSourcedAggregate<MembershipState, MembershipEventPayload> | null> {
    const agg = await this.inner.load(id);
    // version 0 = no events on the stream = the membership does not exist.
    if (agg.version === 0) return null;
    return agg;
  }

  async findByOrgAndUser(
    organizationId: OrganizationId,
    userId: UserId
  ): Promise<EventSourcedAggregate<MembershipState, MembershipEventPayload> | null> {
    const id = membershipIdOf(organizationId, userId);
    return this.findById(id);
  }

  async listByOrganization(
    organizationId: OrganizationId
  ): Promise<
    readonly EventSourcedAggregate<MembershipState, MembershipEventPayload>[]
  > {
    // Scan all Membership events, replay per stream, filter by organizationId.
    const byId = new Map<
      string,
      EventSourcedAggregate<MembershipState, MembershipEventPayload>
    >();
    for await (const e of this.eventStore.readAll()) {
      if (e.aggregateType !== "Membership") continue;
      const key = String(e.aggregateId);
      let agg = byId.get(key);
      if (!agg) {
        agg = EventSourcedAggregateBase.fromReducer<
          MembershipState,
          MembershipEventPayload
        >(
          membershipReducer,
          e.aggregateId,
          membershipReducer.initialState(e.aggregateId)
        );
        byId.set(key, agg);
      }
      agg.apply(e as EventEnvelope<MembershipEventPayload>);
    }
    const out: EventSourcedAggregate<MembershipState, MembershipEventPayload>[] = [];
    const target = String(organizationId);
    for (const agg of byId.values()) {
      if (agg.version > 0 && String(agg.state.organizationId) === target) {
        out.push(agg);
      }
    }
    return out;
  }
}
