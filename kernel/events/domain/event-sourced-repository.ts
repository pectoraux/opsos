/**
 * @kernel/events/domain/event-sourced-repository — generic event-sourced aggregate repo.
 *
 * Rebuilds an aggregate by:
 *   1. loading the latest snapshot (if any),
 *   2. replaying events from `snapshot.version + 1` onward,
 *   3. applying them via the aggregate's `apply` reducer.
 * On save, reads expected version and appends new events with concurrency check.
 *
 * The aggregate contract is minimal & generic: it provides an `apply` reducer
 * and an `id`. Domain modules supply their own concrete aggregate types.
 */

import type {
  StreamId,
  AggregateId,
  Result,
  ConcurrencyConflictError,
  Version,
} from "@kernel/shared-kernel";
import { aggregateStreamId, ANY_VERSION } from "@kernel/shared-kernel";
import type { EventStore, AppendResult } from "./event-store";
import type { SnapshotStore, Snapshot } from "./snapshot-store";
import type { EventEnvelope, EventInput } from "./event-envelope";

/** A reducible event-sourced aggregate. */
export interface EventSourcedAggregate<TState, TEventPayload = unknown> {
  readonly id: AggregateId | string;
  readonly aggregateType: string;
  readonly state: TState;
  readonly version: Version;
  apply(event: EventEnvelope<TEventPayload>): void;
}

export interface AggregateReducer<TState, TEventPayload = unknown> {
  readonly aggregateType: string;
  initialState(id: AggregateId | string): TState;
  reduce(state: TState, event: EventEnvelope<TEventPayload>): TState;
}

export interface EventSourcedRepository<TState, TEventPayload = unknown> {
  load(id: AggregateId | string): Promise<EventSourcedAggregate<TState, TEventPayload>>;
  save(
    aggregate: EventSourcedAggregate<TState, TEventPayload>,
    pendingEvents: readonly EventInput<TEventPayload>[]
  ): Promise<Result<AppendResult, ConcurrencyConflictError>>;
}

export interface EventSourcedRepositoryDeps<TState, TEventPayload> {
  readonly eventStore: EventStore;
  readonly snapshotStore?: SnapshotStore;
  readonly reducer: AggregateReducer<TState, TEventPayload>;
  readonly snapshotEvery?: number;
}

export function streamOf(aggregateType: string, id: AggregateId | string): StreamId {
  return aggregateStreamId(aggregateType, id);
}

export type {
  EventStore,
  AppendResult,
  EventHandler,
  Subscription,
} from "./event-store";
export type { SnapshotStore, Snapshot } from "./snapshot-store";
export type { EventEnvelope, EventInput } from "./event-envelope";
export { ANY_VERSION } from "@kernel/shared-kernel";
