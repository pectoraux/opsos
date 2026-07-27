/**
 * @kernel/api/v1 — EVENTS public surface (FROZEN).
 *
 * Event-sourcing foundation: envelopes, stores, and the event-sourced
 * repository pattern. Shared-kernel types (EventMetadata, NO_VERSION,
 * aggregateStreamId, …) are re-exported via `./shared-kernel` and are
 * intentionally NOT duplicated here.
 */
export type {
  EventEnvelope,
  EventInput,
  EventStore,
  AppendResult,
  EventHandler,
  Subscription,
  EventStreamCursor,
  SnapshotStore,
  Snapshot,
  EventSourcedAggregate,
  AggregateReducer,
  EventSourcedRepository,
  EventSourcedRepositoryDeps,
} from "@kernel/events";

export {
  EventSourcedAggregateBase,
  createEventSourcedRepository,
  InMemoryEventStore,
  InMemorySnapshotStore,
  ANY_VERSION,
  streamOf,
} from "@kernel/events";
