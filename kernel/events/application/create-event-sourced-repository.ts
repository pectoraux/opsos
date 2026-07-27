/**
 * @kernel/events/application — use-cases over the EventStore.
 *
 * `createEventSourcedRepository` wires an EventStore (+ optional SnapshotStore)
 * to a domain reducer, producing a generic event-sourced repository.
 * `appendEvents` is a thin command use-case for direct appends.
 */

import type {
  StreamId,
  AggregateId,
  Result,
  ConcurrencyConflictError,
  Version,
} from "@kernel/shared-kernel";
import { aggregateStreamId, NO_VERSION } from "@kernel/shared-kernel";
import type {
  EventStore,
  AppendResult,
} from "../domain/event-store";
import type { SnapshotStore } from "../domain/snapshot-store";
import type {
  EventSourcedRepository,
  EventSourcedRepositoryDeps,
  AggregateReducer,
} from "../domain/event-sourced-repository";
import type { EventInput, EventEnvelope } from "../domain/event-envelope";
import { EventSourcedAggregateBase } from "../domain/aggregate";

export function createEventSourcedRepository<TState, TEventPayload = unknown>(
  deps: EventSourcedRepositoryDeps<TState, TEventPayload>
): EventSourcedRepository<TState, TEventPayload> {
  const { eventStore, snapshotStore, reducer, snapshotEvery } = deps;

  return {
    async load(id: AggregateId | string) {
      let state: TState;
      let version: Version;
      let fromVersion: Version;

      const snapshot = snapshotStore ? await snapshotStore.load<TState>(id) : null;
      if (snapshot && snapshot.aggregateType === reducer.aggregateType) {
        state = snapshot.state;
        version = snapshot.version;
        fromVersion = version + 1;
      } else {
        state = reducer.initialState(id);
        version = NO_VERSION;
        fromVersion = 1;
      }

      const agg = EventSourcedAggregateBase.fromReducer(reducer, id, state, version);
      const events = await eventStore.readStream(aggregateStreamId(reducer.aggregateType, id), fromVersion);
      for (const e of events) {
        agg.apply(e as EventEnvelope<TEventPayload>);
      }
      return agg;
    },

    async save(aggregate, pendingEvents) {
      const streamId = aggregateStreamId(reducer.aggregateType, aggregate.id);
      const result = await eventStore.append(streamId, pendingEvents, aggregate.version);
      if (!result.ok) return result;

      // Periodic snapshotting (optimisation only).
      if (snapshotStore && snapshotEvery && result.value.toVersion - aggregate.version >= snapshotEvery) {
        await snapshotStore.save<TState>({
          aggregateId: aggregate.id,
          aggregateType: reducer.aggregateType,
          version: result.value.toVersion,
          state: aggregate.state,
          takenAt: result.value.appended[result.value.appended.length - 1]?.timestamp ?? 0,
        });
      }
      return result;
    },
  };
}
