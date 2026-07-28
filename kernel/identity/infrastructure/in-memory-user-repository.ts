/**
 * @kernel/identity/infrastructure/in-memory-user-repository — reference
 * in-memory UserRepository.
 *
 * Wraps the generic `createEventSourcedRepository` from `@kernel/events` with
 * the User reducer, supplying fresh `InMemoryEventStore` / `InMemorySnapshotStore`
 * defaults. Adds `findById` (load + check existence).
 *
 * Suitable for kernel self-test, the read-only inspector, and tests. NOT for
 * production persistence (that's a future adapter).
 *
 * The `generateEventId` injection point lets deterministic runs (runtime with
 * a seeded RandomSource) replay identically — same seed → same event ids →
 * same envelopes → same replayed state.
 */

import type {
  Result,
  ConcurrencyConflictError,
} from "@kernel/shared-kernel";
import {
  InMemoryEventStore,
  InMemorySnapshotStore,
  createEventSourcedRepository,
} from "@kernel/events";
import type {
  EventStore,
  SnapshotStore,
  AppendResult,
  EventSourcedAggregate,
  EventSourcedRepository,
  EventInput,
} from "@kernel/events";
import type { UserId } from "@kernel/shared-kernel";
import type { UserState } from "../domain/user";
import type { UserEventPayload } from "../domain/identity-events";
import { userReducer } from "../domain/user";
import type { UserRepository } from "../domain/user-repository";

/** Constructor deps for `InMemoryUserRepository`. All optional. */
export interface InMemoryUserRepositoryDeps {
  /** Inject a shared EventStore (e.g. the kernel's global store). Defaults to a fresh in-memory one. */
  readonly eventStore?: EventStore;
  /** Inject a shared SnapshotStore. Defaults to a fresh in-memory one. */
  readonly snapshotStore?: SnapshotStore;
  /** Deterministic eventId generator (inject a seeded one for replay). */
  readonly generateEventId?: () => string;
  /** Snapshot every N events (0 = never). Default: 0. */
  readonly snapshotEvery?: number;
}

export class InMemoryUserRepository implements UserRepository {
  private readonly inner: EventSourcedRepository<UserState, UserEventPayload>;
  private readonly eventStore: EventStore;

  constructor(deps: InMemoryUserRepositoryDeps = {}) {
    this.eventStore =
      deps.eventStore ??
      new InMemoryEventStore({
        generateEventId: deps.generateEventId,
      });
    this.inner = createEventSourcedRepository<UserState, UserEventPayload>({
      eventStore: this.eventStore,
      snapshotStore: deps.snapshotStore ?? new InMemorySnapshotStore(),
      reducer: userReducer,
      snapshotEvery: deps.snapshotEvery,
    });
  }

  /** The underlying event store (useful for projections / inspection). */
  get store(): EventStore {
    return this.eventStore;
  }

  async load(
    id: UserId
  ): Promise<EventSourcedAggregate<UserState, UserEventPayload>> {
    return this.inner.load(id);
  }

  async save(
    aggregate: EventSourcedAggregate<UserState, UserEventPayload>,
    pendingEvents: readonly EventInput<UserEventPayload>[]
  ): Promise<Result<AppendResult, ConcurrencyConflictError>> {
    return this.inner.save(aggregate, pendingEvents);
  }

  async findById(
    id: UserId
  ): Promise<EventSourcedAggregate<UserState, UserEventPayload> | null> {
    const agg = await this.inner.load(id);
    // version 0 = no events on the stream = the user does not exist.
    if (agg.version === 0) return null;
    return agg;
  }
}
