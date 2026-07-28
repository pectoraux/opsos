/**
 * @kernel/ai-workforce/infrastructure/in-memory-memory-store — the reference
 * `MemoryStore` implementation.
 *
 * Holds per-agent memory in a `Map<string, MemoryEntry[]>` keyed by agent id
 * (insertion order preserved per agent).
 *
 * Semantics:
 *   - `record(agentId, entry)` — append. Creates the agent's entry list if
 *     absent.
 *   - `recall(agentId, query?)` — return entries filtered by:
 *       (a) not expired (`expiresAt` is undefined OR `expiresAt > now`)
 *           — but `now` is NOT supplied by the caller to `recall`. The store
 *           uses an injected `clock` (default: a fixed clock at 0). The
 *           rationale: recall is read-only and should not require callers to
 *           thread `now` through every read; the clock is configured once at
 *           store construction.
 *       (b) optional substring match on `content` (case-insensitive)
 *     Returned in chronological order (timestamp ascending), then id ascending
 *     for ties. Fresh array each call.
 *   - `forget(agentId, entryId)` — remove the entry with `entryId` from
 *     `agentId`'s list. Idempotent (no-op if absent).
 *   - `consolidate(agentId)` — heuristic: drop expired entries; merge
 *     consecutive `observation` entries with identical `content` into a
 *     single entry (keeping the latest timestamp + max confidence); cap the
 *     list at the configured `maxEntries` (default 1000) by dropping the
 *     OLDEST entries. Pure w.r.t. the agent's memory at call time.
 *
 * Determinism: no `Date.now()` / `Math.random()`. The store uses an injected
 * `RuntimeClock` (default: a fixed clock at 0) for expiry checks. All listings
 * are deterministic (sorted by timestamp ascending, then id ascending).
 *
 * Suitable for kernel self-test, the read-only inspector, and tests. NOT for
 * production persistence (no durability, no compression, no vector search).
 */
import { type RuntimeClock, FixedClock } from "@kernel/shared-kernel";
import type { MemoryEntry, MemoryStore } from "../domain";

/**
 * Options for `InMemoryMemoryStore`.
 */
export interface InMemoryMemoryStoreOptions {
  /** Clock used for expiry checks. Default: fixed clock at 0. */
  readonly clock?: RuntimeClock;
  /** Max entries per agent before consolidation drops the oldest. Default 1000. */
  readonly maxEntries?: number;
}

/**
 * Reference in-memory `MemoryStore`. See file-level JSDoc.
 */
export class InMemoryMemoryStore implements MemoryStore {
  /** Per-agent entries. Insertion order preserved per agent. */
  private readonly store: Map<string, MemoryEntry[]> = new Map();

  private readonly clock: RuntimeClock;
  private readonly maxEntries: number;

  constructor(options: InMemoryMemoryStoreOptions = {}) {
    this.clock = options.clock ?? new MemoryFixedClock(0);
    this.maxEntries = options.maxEntries ?? 1000;
  }

  /** Append `entry` to `agentId`'s memory. Creates the list if absent. */
  record(agentId: string, entry: MemoryEntry): void {
    const list = this.store.get(agentId);
    if (list === undefined) {
      this.store.set(agentId, [entry]);
    } else {
      list.push(entry);
    }
  }

  /**
   * Return `agentId`'s entries, filtered by:
   *   (a) not expired (per `expiresAt` and the injected clock's `now()`)
   *   (b) optional substring match on `content` (case-insensitive)
   * Returned in chronological order (timestamp ascending), then id ascending.
   * Fresh array each call.
   */
  recall(agentId: string, query?: string): readonly MemoryEntry[] {
    const list = this.store.get(agentId);
    if (list === undefined) {
      return [];
    }
    const now = this.clock.now();
    const q = query !== undefined ? query.toLowerCase() : undefined;
    return list
      .filter((e) => e.expiresAt === undefined || e.expiresAt > now)
      .filter(
        (e) =>
          q === undefined || e.content.toLowerCase().includes(q)
      )
      .slice()
      .sort((a, b) => {
        if (a.timestamp !== b.timestamp) {
          return a.timestamp - b.timestamp;
        }
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
  }

  /** Remove the entry with `entryId` from `agentId`'s memory. Idempotent. */
  forget(agentId: string, entryId: string): void {
    const list = this.store.get(agentId);
    if (list === undefined) {
      return;
    }
    const idx = list.findIndex((e) => e.id === entryId);
    if (idx >= 0) {
      list.splice(idx, 1);
    }
  }

  /**
   * Consolidate `agentId`'s memory:
   *   1. drop expired entries (per `expiresAt` and the injected clock's `now()`)
   *   2. merge consecutive `observation` entries with identical `content`
   *      into a single entry (keep the latest timestamp + max confidence +
   *      the latest id)
   *   3. cap the list at `maxEntries` by dropping the OLDEST entries
   *
   * Pure w.r.t. the agent's memory at call time.
   */
  consolidate(agentId: string): void {
    const list = this.store.get(agentId);
    if (list === undefined) {
      return;
    }
    const now = this.clock.now();

    // 1. Drop expired.
    const fresh = list.filter(
      (e) => e.expiresAt === undefined || e.expiresAt > now
    );

    // 2. Merge consecutive observations with identical content.
    const merged: MemoryEntry[] = [];
    for (const entry of fresh) {
      const last = merged[merged.length - 1];
      if (
        last !== undefined &&
        last.kind === "observation" &&
        entry.kind === "observation" &&
        last.content === entry.content
      ) {
        // Merge: keep latest timestamp + max confidence + latest id.
        const mergedEntry: MemoryEntry = {
          id: entry.timestamp >= last.timestamp ? entry.id : last.id,
          kind: "observation",
          content: last.content,
          confidence: Math.max(last.confidence, entry.confidence),
          timestamp: Math.max(last.timestamp, entry.timestamp),
        };
        // Preserve expiresAt if present on either side (use the later one).
        if (last.expiresAt !== undefined || entry.expiresAt !== undefined) {
          (mergedEntry as { expiresAt?: number }).expiresAt =
            last.expiresAt !== undefined && entry.expiresAt !== undefined
              ? Math.max(last.expiresAt, entry.expiresAt)
              : last.expiresAt ?? entry.expiresAt;
        }
        merged[merged.length - 1] = mergedEntry;
      } else {
        merged.push(entry);
      }
    }

    // 3. Cap at maxEntries by dropping the OLDEST.
    if (merged.length > this.maxEntries) {
      // Sort by timestamp ascending then id ascending, drop the oldest.
      merged.sort((a, b) => {
        if (a.timestamp !== b.timestamp) {
          return a.timestamp - b.timestamp;
        }
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
      const drop = merged.length - this.maxEntries;
      merged.splice(0, drop);
    }

    this.store.set(agentId, merged);
  }

  // ── Introspection helpers (NOT part of the MemoryStore port) ────────────

  /** Number of entries for `agentId` (raw — includes expired). For tests. */
  rawCount(agentId: string): number {
    return this.store.get(agentId)?.length ?? 0;
  }

  /** All agent ids with memory. For tests / diagnostics. */
  agentIds(): readonly string[] {
    return Array.from(this.store.keys()).sort();
  }

  /** Remove all memory for all agents. For tests / diagnostics. */
  clear(): void {
    this.store.clear();
  }
}

/**
 * Concrete fixed clock for the memory store. Defaults to `now()=0`. Used as
 * the shared time source when no `RuntimeClock` is injected. Mirrors the
 * pattern in the intelligence module.
 */
export class MemoryFixedClock extends FixedClock {
  constructor(now: number = 0) {
    super(now, 0);
  }
}
