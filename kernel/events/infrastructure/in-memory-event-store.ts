/**
 * @kernel/events/infrastructure/in-memory-event-store — reference in-memory
 * EventStore. Suitable for tests, kernel self-bootstrap, and the read-only
 * inspector. NOT for production persistence (that's a future adapter).
 *
 * `eventId`s are produced by an injected `generateEventId` function so that
 * deterministic runs (runtime with a seeded RandomSource) replay identically.
 */

import type {
  StreamId,
  Result,
  Version,
  EventId,
} from "@kernel/shared-kernel";
import { ANY_VERSION, ConcurrencyConflictError, asId } from "@kernel/shared-kernel";
import type {
  EventStore,
  AppendResult,
  EventHandler,
  Subscription,
} from "../domain/event-store";
import type { EventEnvelope, EventInput } from "../domain/event-envelope";

export interface InMemoryEventStoreOptions {
  /** Deterministic ID source for eventIds (inject a seeded one for replay). */
  generateEventId?: () => string;
}

export class InMemoryEventStore implements EventStore {
  private readonly events: EventEnvelope[] = [];
  private readonly byStream: Map<string, EventEnvelope[]> = new Map();
  private readonly subscribers: Map<string, EventHandler> = new Map();
  private subSeq = 0;
  private readonly generateEventId: () => string;

  private fallbackSeq = 0;

  constructor(opts: InMemoryEventStoreOptions = {}) {
    this.generateEventId =
      opts.generateEventId ??
      (() => {
        // Determinism-compliant fallback (ADR-0002): NO Date.now()/Math.random().
        // Prefer an injected seeded generator (from RuntimeClock/RandomSource) for
        // deterministic replay. crypto.randomUUID is acceptable only when present
        // (non-deterministic but unique); otherwise use a monotonic counter so the
        // store remains usable in environments without crypto without leaking time.
        if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
          return crypto.randomUUID();
        }
        return "evt-" + (++this.fallbackSeq).toString(36);
      });
  }

  async append(
    streamId: StreamId,
    inputs: readonly EventInput[],
    expectedVersion: Version
  ): Promise<Result<AppendResult, ConcurrencyConflictError>> {
    const key = String(streamId);
    const stream = this.byStream.get(key) ?? [];
    const currentVersion = stream.length > 0 ? stream[stream.length - 1].version : 0;

    if (expectedVersion !== ANY_VERSION && expectedVersion !== currentVersion) {
      return {
        ok: false,
        error: new ConcurrencyConflictError(key, expectedVersion, currentVersion),
      };
    }

    const appended: EventEnvelope[] = [];
    let version = currentVersion;
    for (const input of inputs) {
      version += 1;
      const envelope: EventEnvelope = {
        eventId: asId<"EventId">(this.generateEventId()),
        streamId,
        aggregateId: input.aggregateId,
        aggregateType: input.aggregateType,
        eventType: input.eventType,
        timestamp: input.timestamp,
        version,
        metadata: input.metadata,
        payload: input.payload,
      };
      stream.push(envelope);
      this.events.push(envelope);
      appended.push(envelope);
    }
    this.byStream.set(key, stream);

    // Notify subscribers (best-effort, after commit).
    for (const handler of this.subscribers.values()) {
      for (const e of appended) {
        await handler(e);
      }
    }

    return {
      ok: true,
      value: {
        streamId,
        fromVersion: currentVersion,
        toVersion: version,
        appended,
      },
    };
  }

  async readStream(
    streamId: StreamId,
    fromVersion: Version = 1
  ): Promise<readonly EventEnvelope[]> {
    const stream = this.byStream.get(String(streamId)) ?? [];
    return stream.filter((e) => e.version >= fromVersion);
  }

  async streamVersion(streamId: StreamId): Promise<Version> {
    const stream = this.byStream.get(String(streamId)) ?? [];
    return stream.length > 0 ? stream[stream.length - 1].version : 0;
  }

  async *readAll(fromPosition: number = 0): AsyncIterable<EventEnvelope> {
    for (let i = fromPosition; i < this.events.length; i++) {
      yield this.events[i];
    }
  }

  subscribe(handler: EventHandler): Subscription {
    const id = "sub-" + ++this.subSeq;
    this.subscribers.set(id, handler);
    return {
      id,
      unsubscribe: () => {
        this.subscribers.delete(id);
      },
    };
  }

  globalPosition(): number {
    return this.events.length;
  }

  /** Test/inspector helper: a defensive snapshot of all events. */
  snapshot(): readonly EventEnvelope[] {
    return this.events.slice();
  }
}
