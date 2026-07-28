/**
 * @kernel/events/domain/event-store — the EventStore port.
 *
 * Append-only, optimistic-concurrency-enforcing store of immutable events.
 * `append` rejects with `ConcurrencyConflictError` when `expectedVersion` does
 * not match the stream's current version (unless `expectedVersion === ANY_VERSION`).
 */

import type { StreamId, Result, ConcurrencyConflictError } from "@kernel/shared-kernel";
import type { EventEnvelope, EventInput } from "./event-envelope";
import { ANY_VERSION, type Version } from "@kernel/shared-kernel";

export interface AppendResult {
  readonly streamId: StreamId;
  readonly fromVersion: Version;
  readonly toVersion: Version;
  readonly appended: readonly EventEnvelope[];
}

export interface EventStreamCursor {
  readonly position: number;
}

export type EventHandler = (envelope: EventEnvelope) => void | Promise<void>;

export interface Subscription {
  readonly id: string;
  unsubscribe(): void;
}

export interface EventStore {
  /**
   * Append events to a stream. Enforces optimistic concurrency when
   * `expectedVersion !== ANY_VERSION`.
   */
  append(
    streamId: StreamId,
    events: readonly EventInput[],
    expectedVersion: Version
  ): Promise<Result<AppendResult, ConcurrencyConflictError>>;

  /** Read a stream forward from `fromVersion` (inclusive, 1-based). */
  readStream(streamId: StreamId, fromVersion?: Version): Promise<readonly EventEnvelope[]>;

  /** Current version of a stream (0 if empty). */
  streamVersion(streamId: StreamId): Promise<Version>;

  /** Iterate all events globally from a position — for projection catch-up. */
  readAll(fromPosition?: number): AsyncIterable<EventEnvelope>;

  /** Subscribe to live appends. */
  subscribe(handler: EventHandler): Subscription;

  /** Global append position (monotonic across all streams). */
  globalPosition(): number;
}

export { ANY_VERSION } from "@kernel/shared-kernel";
