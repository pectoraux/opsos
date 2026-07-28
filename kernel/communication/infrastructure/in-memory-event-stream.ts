/**
 * @kernel/communication/infrastructure/in-memory-event-stream — the default
 * in-memory `CommunicationEventStream` implementation.
 *
 * Backed by a bounded ring-buffer of events (default capacity 1024) plus a
 * list of subscribers. `publish()` appends to the buffer and fans out to all
 * subscribers synchronously.
 *
 * Determinism: pure data structure. The event id and timestamp are supplied by
 * the publisher (the engine mints deterministic ids via `hashSeed`); the
 * stream does NOT generate ids or timestamps itself.
 *
 * Subscriber contract: handlers MUST not throw. The in-memory implementation
 * wraps each call in a try/catch — a throwing handler is silently dropped
 * (the event is still recorded). This is the ONLY try/catch in the
 * communication runtime; it is localised to the publish fan-out so a misbehaving
 * subscriber cannot break the dispatch loop.
 */
import type {
  CommunicationEvent,
  CommunicationEventHandler,
  CommunicationEventStream,
} from "../domain";

export interface InMemoryEventStreamOptions {
  /** Maximum events retained for `recent()`. Default 1024. */
  readonly capacity?: number;
}

export class InMemoryEventStream implements CommunicationEventStream {
  private readonly buffer: CommunicationEvent[] = [];
  private readonly capacity: number;
  private readonly subscribers = new Set<CommunicationEventHandler>();

  constructor(opts: InMemoryEventStreamOptions = {}) {
    this.capacity = opts.capacity ?? 1024;
  }

  publish(event: CommunicationEvent): void {
    this.buffer.push(event);
    if (this.buffer.length > this.capacity) {
      this.buffer.shift();
    }
    for (const handler of this.subscribers) {
      try {
        handler(event);
      } catch {
        // A misbehaving subscriber MUST NOT break the publish loop or affect
        // other subscribers. Silently drop the failure (the event is still
        // recorded in the buffer for later replay).
      }
    }
  }

  subscribe(handler: CommunicationEventHandler): () => void {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  recent(count: number): readonly CommunicationEvent[] {
    if (count <= 0) return [];
    if (count >= this.buffer.length) return this.buffer.slice();
    return this.buffer.slice(this.buffer.length - count);
  }

  /** Internal: current buffer size (for diagnostics / tests). */
  size(): number {
    return this.buffer.length;
  }
}
