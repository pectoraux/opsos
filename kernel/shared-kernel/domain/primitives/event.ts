/**
 * @kernel/shared-kernel/domain/primitives/event — the canonical Event.
 *
 * The concrete envelope (`EventEnvelope`) lives in `@kernel/events` and
 * structurally satisfies this canonical `Event`. `timestamp` is always sourced
 * from `RuntimeClock`; `version` is the per-stream monotonic counter used for
 * optimistic concurrency.
 */

import type { EventId, AggregateId, StreamId } from "../identifiers";
import type { UnknownPayload, UnknownRecord } from "../value-objects";

export interface EventMetadata {
  readonly correlationId: string;
  readonly causationId?: string;
  readonly principalId?: string;
  readonly tenantId?: string;
  readonly traceId?: string;
  readonly source?: string;
  readonly [k: string]: unknown;
}

export interface Event<TPayload = UnknownPayload> {
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

/** A namespaced event-type string, e.g. `OrganizationCreated`. */
export type EventType = string;

/** Minimal shape a payload must satisfy to be stored. */
export type EventPayload = UnknownRecord;
