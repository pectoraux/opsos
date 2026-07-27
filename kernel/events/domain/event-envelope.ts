/**
 * @kernel/events/domain/event-envelope — the concrete event envelope.
 *
 * Structurally satisfies the canonical `Event` from shared-kernel, specialised
 * with the envelope concerns needed for storage/replay (streamId, version,
 * metadata). `timestamp` MUST be sourced from `ExecutionContext.clock`.
 */

import type {
  EventId,
  AggregateId,
  StreamId,
} from "@kernel/shared-kernel";
import type { Event, EventMetadata } from "@kernel/shared-kernel";

export interface EventEnvelope<TPayload = unknown> extends Event<TPayload> {
  readonly eventId: EventId;
  readonly streamId: StreamId;
  readonly aggregateId: AggregateId | string;
  readonly aggregateType: string;
  readonly eventType: string;
  readonly timestamp: number;
  readonly version: number;
  readonly metadata: EventMetadata;
  readonly payload: TPayload;
}

/** Inputs needed to build an envelope (everything except `version`, assigned by the store). */
export interface EventInput<TPayload = unknown> {
  readonly aggregateId: AggregateId | string;
  readonly aggregateType: string;
  readonly eventType: string;
  readonly timestamp: number;
  readonly metadata: EventMetadata;
  readonly payload: TPayload;
}
