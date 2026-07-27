/**
 * @kernel/coordination/infrastructure/in-memory-queue-engine — the in-memory
 * `QueueEngine` implementation.
 *
 * Pure data structures + a per-instance counter for id minting. No
 * `Date.now()`, no `Math.random()`. All time comes from the `now` argument;
 * weighted-random selection uses the caller-supplied `RandomSource` (seeded)
 * from `QueueEngineContext.random`. When no `RandomSource` is supplied for a
 * `weighted` queue, the engine falls back to a deterministic
 * heaviest-weight-first pick (ties broken by insertion order) — this is the
 * documented round-robin-within-weight-classes degenerate.
 *
 * Disciplines:
 *   - `fifo`     — pick entries[0] (insertion order).
 *   - `priority` — pick max(priority.level); ties by insertion order.
 *   - `weighted` — weighted-random (with seeded source) OR heaviest-first
 *                   (without). Entries without explicit weight default to
 *                   `DEFAULT_QUEUE_WEIGHT` (1).
 *   - `deadline` — pick min(deadline); entries without a deadline sink to the
 *                   back (stable within that group).
 *
 * `enqueue` appends to `entries` and stamps `enqueuedAt = now` if absent.
 * `dequeue` returns `{ queue, entry }` where the queue has the entry removed.
 * `peek` returns the next entry WITHOUT removing it. `length` returns the
 * entry count.
 */

import { asId } from "@kernel/shared-kernel";
import type {
  QueueId,
  TenantId,
  Queue,
  QueueEntry,
  QueueDiscipline,
  RandomSource,
} from "@kernel/shared-kernel";
import type {
  QueueEnqueueInput,
  QueueDequeueResult,
  QueueEngineContext,
  QueueEngine,
} from "../domain";
import { DEFAULT_QUEUE_WEIGHT } from "../domain";

export class InMemoryQueueEngine implements QueueEngine {
  private counter = 0;

  create(
    name: string,
    discipline: QueueDiscipline,
    tenantId: TenantId,
    now: number
  ): Queue {
    const id = this.mintQueueId(tenantId, name, now);
    return {
      id,
      tenantId,
      name,
      discipline,
      entries: [],
      createdAt: now,
    };
  }

  enqueue(queue: Queue, entry: QueueEnqueueInput, now: number): Queue {
    const stampedEntry: QueueEntry = {
      id: entry.id,
      itemRef: entry.itemRef,
      priority: entry.priority,
      weight: entry.weight,
      deadline: entry.deadline,
      enqueuedAt: entry.enqueuedAt ?? now,
    };
    return {
      ...queue,
      entries: [...queue.entries, stampedEntry],
    };
  }

  dequeue(
    queue: Queue,
    _now: number,
    context?: QueueEngineContext
  ): QueueDequeueResult {
    if (queue.entries.length === 0) {
      return { queue, entry: undefined };
    }
    const idx = this.pickIndex(queue, context);
    const entry = queue.entries[idx];
    const remaining = [
      ...queue.entries.slice(0, idx),
      ...queue.entries.slice(idx + 1),
    ];
    return {
      queue: { ...queue, entries: remaining },
      entry,
    };
  }

  peek(queue: Queue, context?: QueueEngineContext): QueueEntry | undefined {
    if (queue.entries.length === 0) return undefined;
    const idx = this.pickIndex(queue, context);
    return queue.entries[idx];
  }

  length(queue: Queue): number {
    return queue.entries.length;
  }

  // ── Internal: pick the next-entry index per discipline ───────────────────
  private pickIndex(queue: Queue, context?: QueueEngineContext): number {
    switch (queue.discipline) {
      case "fifo":
        return this.pickFifo(queue.entries);
      case "priority":
        return this.pickPriority(queue.entries);
      case "weighted":
        return this.pickWeighted(queue.entries, context?.random);
      case "deadline":
        return this.pickDeadline(queue.entries);
      default:
        // Exhaustive: unknown discipline falls back to FIFO (deterministic).
        return this.pickFifo(queue.entries);
    }
  }

  private pickFifo(entries: readonly QueueEntry[]): number {
    // FIFO: earliest enqueuedAt; ties by array index.
    let bestIdx = 0;
    let bestAt = entries[0].enqueuedAt;
    for (let i = 1; i < entries.length; i++) {
      if (entries[i].enqueuedAt < bestAt) {
        bestAt = entries[i].enqueuedAt;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  private pickPriority(entries: readonly QueueEntry[]): number {
    // Priority: max priority.level; ties by earliest enqueuedAt.
    let bestIdx = 0;
    let best = entries[0];
    for (let i = 1; i < entries.length; i++) {
      const e = entries[i];
      if (
        e.priority.level > best.priority.level ||
        (e.priority.level === best.priority.level &&
          e.enqueuedAt < best.enqueuedAt)
      ) {
        best = e;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  private pickWeighted(
    entries: readonly QueueEntry[],
    random?: RandomSource
  ): number {
    if (entries.length === 1) return 0;
    const weights = entries.map(
      (e) => (e.weight ?? DEFAULT_QUEUE_WEIGHT) as number
    );
    const total = weights.reduce((sum, w) => sum + w, 0);

    if (random !== undefined && total > 0) {
      // Weighted-random selection. Deterministic given the seeded source.
      const r = random.next() * total;
      let cumulative = 0;
      for (let i = 0; i < entries.length; i++) {
        cumulative += weights[i];
        if (r < cumulative) return i;
      }
      // Floating-point safety net: fall through to heaviest-first.
    }

    // Deterministic fallback: heaviest weight first; ties by earliest enqueuedAt.
    let bestIdx = 0;
    let bestWeight = weights[0];
    let bestAt = entries[0].enqueuedAt;
    for (let i = 1; i < entries.length; i++) {
      if (
        weights[i] > bestWeight ||
        (weights[i] === bestWeight && entries[i].enqueuedAt < bestAt)
      ) {
        bestIdx = i;
        bestWeight = weights[i];
        bestAt = entries[i].enqueuedAt;
      }
    }
    return bestIdx;
  }

  private pickDeadline(entries: readonly QueueEntry[]): number {
    // Deadline: earliest deadline; entries without a deadline sink to the
    // back (stable within that group by enqueuedAt).
    let bestIdx = 0;
    let best = entries[0];
    for (let i = 1; i < entries.length; i++) {
      const e = entries[i];
      if (this.deadlineIsEarlier(e, best)) {
        best = e;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  private deadlineIsEarlier(a: QueueEntry, b: QueueEntry): boolean {
    // Defined-deadline entries always outrank undefined-deadline ones.
    if (a.deadline !== undefined && b.deadline === undefined) return true;
    if (a.deadline === undefined && b.deadline !== undefined) return false;
    if (a.deadline !== undefined && b.deadline !== undefined) {
      if (a.deadline !== b.deadline) return a.deadline < b.deadline;
      // Same deadline: earlier enqueuedAt wins.
      return a.enqueuedAt < b.enqueuedAt;
    }
    // Both undefined: earlier enqueuedAt wins.
    return a.enqueuedAt < b.enqueuedAt;
  }

  // ── Internal: id minting ────────────────────────────────────────────────
  private mintQueueId(tenantId: TenantId, name: string, now: number): QueueId {
    this.counter += 1;
    return asId<"QueueId">(`queue#${tenantId}#${name}#${now}#${this.counter}`);
  }
}
