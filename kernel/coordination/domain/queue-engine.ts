/**
 * @kernel/coordination/domain/queue-engine — the QueueEngine PORT.
 *
 * A Queue is a work buffer with a discipline (FIFO / priority / weighted /
 * deadline). The QueueEngine has five pure transitions:
 *
 *   create(name, discipline, tenantId, now) → Queue { entries: [] }
 *   enqueue(queue, entry, now)              → Queue (entries appended)
 *   dequeue(queue, now)                     → { queue: <reduced>, entry: <picked> | undefined }
 *   peek(queue)                             → QueueEntry | undefined
 *   length(queue)                           → number
 *
 * Disciplines (FROZEN):
 *   - `fifo`      — first-in-first-out by `enqueuedAt` (insertion order).
 *   - `priority`  — by `priority.level` DESC, then by insertion order.
 *   - `weighted`  — weighted-random selection (deterministic given a seeded
 *                   `RandomSource` injected by the caller). Entries without an
 *                   explicit `weight` default to 1.
 *   - `deadline`  — earliest `deadline` first; entries without a deadline sink
 *                   to the back (stable within that group).
 *
 * Determinism rule: `now` is supplied by the caller. The `weighted` discipline
 * requires an injected `RandomSource` (see `@kernel/shared-kernel`); if none is
 * supplied, the engine falls back to a deterministic round-robin within weight
 * classes (NOT `Math.random()`). All other disciplines are deterministic
 * without any randomness.
 */

import type {
  QueueId,
  TenantId,
} from "@kernel/shared-kernel";
import type {
  Queue,
  QueueEntry,
  QueueDiscipline,
  Priority,
} from "@kernel/shared-kernel";
import type { RandomSource } from "@kernel/shared-kernel";

/**
 * The arguments for `enqueue` — the entry to add. The engine stamps
 * `enqueuedAt = now` if the caller did not.
 */
export interface QueueEnqueueInput {
  readonly id: string;
  readonly itemRef: string;
  readonly priority: Priority;
  readonly weight?: number;
  readonly deadline?: number;
  readonly enqueuedAt?: number;
}

/**
 * The result of `dequeue`: the reduced `queue` (entry removed) plus the
 * dequeued `entry` (or `undefined` if the queue was empty).
 */
export interface QueueDequeueResult {
  readonly queue: Queue;
  readonly entry: QueueEntry | undefined;
}

/**
 * Optional engine context — currently used only to supply the `RandomSource`
 * for the `weighted` discipline. Future hooks may land here.
 */
export interface QueueEngineContext {
  readonly random?: RandomSource;
}

/**
 * The QueueEngine PORT. Every method is PURE: returns a NEW `Queue` (or
 * `{queue, entry}`); never mutates the input.
 */
export interface QueueEngine {
  /**
   * Create an empty queue with the given `discipline`. `id` is minted by the
   * engine (deterministically from `tenantId`, `name`, `now`, and an internal
   * counter — see `in-memory-queue-engine.ts`).
   */
  create(
    name: string,
    discipline: QueueDiscipline,
    tenantId: TenantId,
    now: number
  ): Queue;

  /**
   * Append `entry` to the queue. The entry's `enqueuedAt` is set to `now` if
   * not already provided. Returns a new `Queue`.
   */
  enqueue(queue: Queue, entry: QueueEnqueueInput, now: number): Queue;

  /**
   * Dequeue the next entry per the queue's discipline. Returns `{ queue, entry }`
   * where `queue` has the entry removed and `entry` is the picked entry (or
   * `undefined` if the queue is empty).
   */
  dequeue(
    queue: Queue,
    now: number,
    context?: QueueEngineContext
  ): QueueDequeueResult;

  /** Peek at the next entry WITHOUT removing it. */
  peek(queue: Queue, context?: QueueEngineContext): QueueEntry | undefined;

  /** The number of entries currently in the queue. */
  length(queue: Queue): number;
}

/**
 * The default weight applied to entries that omit `weight` in the `weighted`
 * discipline. Kept here (exported) so callers / tests can reason about the
 * formula.
 */
export const DEFAULT_QUEUE_WEIGHT = 1;

export type { QueueId, Queue, QueueEntry, QueueDiscipline, Priority, RandomSource };
