/**
 * @kernel/twin-runtime/domain/twin-history — the TwinHistory aggregate +
 * HistoryStore PORT.
 *
 * A `TwinHistory` is the immutable, append-only journal of `TwinSnapshot`s
 * for an entity. The `HistoryStore` port persists and queries these journals.
 *
 * Determinism rule: pure types — no `Date.now()`, no `Math.random()`. All
 * time flows through the `now` argument supplied by the caller.
 */

import type { TwinSnapshot } from "./twin-state";

/**
 * The history journal for a single entity. Pure data — the HistoryStore is
 * the port that produces and persists these.
 */
export interface TwinHistory {
  readonly entityId: string;
  readonly snapshots: readonly TwinSnapshot[];
}

/**
 * The HistoryStore PORT. Implementations MUST be pure functions of their
 * inputs. `getHistory` returns snapshots whose `timestamp` falls in
 * `[from, to]` (inclusive both ends), ordered ascending by timestamp.
 */
export interface HistoryStore {
  record(entityId: string, snapshot: TwinSnapshot): void;
  getHistory(entityId: string, from: number, to: number): readonly TwinSnapshot[];
  getLatest(entityId: string): TwinSnapshot | undefined;
}
