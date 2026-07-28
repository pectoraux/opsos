/**
 * @kernel/ai-workforce/domain/agent-memory — AgentMemory + MemoryEntry + the
 * MemoryStore PORT.
 *
 * An AI agent's memory is its long-term context: observations, decisions,
 * lessons, context, and goals it has accumulated. Memory is per-agent and
 * append-only (entries can be forgotten but never mutated in place). Memory
 * is what lets an agent be consistent across turns, learn from past
 * decisions, and ground its actions in context.
 *
 * `MemoryEntry` kinds:
 *   - `observation` — something the agent perceived (a system event, an output
 *                     from another agent, a telemetry reading).
 *   - `decision`    — a decision the agent made (action + rationale + cost).
 *   - `lesson`      — a derived heuristic or takeaway (often from
 *                     consolidation — pattern across many observations).
 *   - `context`     — background context the agent should remember (org
 *                     policies, role definitions, team objectives).
 *   - `goal`        — an objective the agent is working toward (from a team
 *                     objective or a director directive).
 *
 * `confidence` is in [0, 1] and is the agent's self-reported belief in the
 * entry. The kernel stores it but does NOT compute it (the agent — or its
 * backing AI provider — supplies it). `expiresAt` is optional; when present,
 * recall SHOULD filter out expired entries (the in-memory store does).
 *
 * The `MemoryStore` PORT is the storage interface. Concrete implementations
 * live in `infrastructure/`. The PORT is intentionally minimal:
 *   - `record(agentId, entry)` — append an entry
 *   - `recall(agentId, query?)` — return entries (filtered / ordered by impl)
 *   - `forget(agentId, entryId)` — remove a specific entry
 *   - `consolidate(agentId)` — collapse low-value / expired / redundant
 *     entries into a smaller set (impl-defined heuristic)
 *
 * Determinism rule: no `Date.now()` / `Math.random()`. All time via
 * `entry.timestamp` / `entry.expiresAt` (caller-supplied). The store is pure
 * data structure.
 *
 * Layering: domain depends ONLY on `@kernel/shared-kernel`.
 */
import {
  type KernelError,
  type Result,
  ValidationError,
  err,
  ok,
} from "@kernel/shared-kernel";

/**
 * The kind of a memory entry. See file-level JSDoc.
 */
export type MemoryEntryKind =
  | "observation"
  | "decision"
  | "lesson"
  | "context"
  | "goal";

/**
 * A single immutable memory entry. See file-level JSDoc.
 */
export interface MemoryEntry {
  readonly id: string;
  readonly kind: MemoryEntryKind;
  readonly content: string;
  /** Self-reported belief in the entry, in [0, 1]. */
  readonly confidence: number;
  /** Caller-supplied epoch-millis. */
  readonly timestamp: number;
  /** Optional expiry; when present, recall SHOULD filter out expired entries. */
  readonly expiresAt?: number;
}

/**
 * The agent's accumulated memory. Entries are stored in append order. The
 * store may have its own ordering policy on recall (e.g. by timestamp desc).
 */
export interface AgentMemory {
  readonly id: string;
  readonly agentId: string;
  readonly entries: readonly MemoryEntry[];
}

/**
 * The MemoryStore PORT. Every method is synchronous and pure w.r.t. the
 * store's internal state. See file-level JSDoc.
 *
 * `record` is the ONLY mutation surface — entries are append-only. `forget`
 * removes a single entry by id. `consolidate` MAY remove / rewrite entries
 * (impl-defined heuristic — typically: drop expired entries, merge duplicate
 * observations, summarize old decisions into lessons).
 */
export interface MemoryStore {
  /** Append `entry` to `agentId`'s memory. Creates the memory if absent. */
  record(agentId: string, entry: MemoryEntry): void;
  /**
   * Return entries for `agentId`. If `query` is supplied, implementations MAY
   * filter / rank by it (substring match on content, kind filter, etc.).
   * Returns a fresh array each call. Expired entries (per `expiresAt`) are
   * typically excluded — impl-defined.
   */
  recall(agentId: string, query?: string): readonly MemoryEntry[];
  /** Remove the entry with `entryId` from `agentId`'s memory. Idempotent. */
  forget(agentId: string, entryId: string): void;
  /**
   * Consolidate `agentId`'s memory: drop expired entries, merge duplicates,
   * summarize old decisions into lessons. Impl-defined heuristic. Pure w.r.t.
   * the agent's memory contents at call time.
   */
  consolidate(agentId: string): void;
}

/**
 * Pure structural validation of a `MemoryEntry`. Returns
 * `err(ValidationError)` with a `details[]` list on failure, `ok(undefined)`
 * on success.
 *
 * Checks: id non-empty, kind is a known value, content non-empty, confidence
 * in [0, 1], timestamp is a non-negative number, expiresAt (if present) is a
 * non-negative number.
 */
export function validateMemoryEntry(
  entry: MemoryEntry
): Result<void, KernelError> {
  const details: Array<{ field: string; reason: string }> = [];

  if (!entry.id || entry.id.trim() === "") {
    details.push({ field: "id", reason: "must be non-empty" });
  }
  const validKinds: readonly MemoryEntryKind[] = [
    "observation",
    "decision",
    "lesson",
    "context",
    "goal",
  ];
  if (!validKinds.includes(entry.kind)) {
    details.push({ field: "kind", reason: `unknown kind '${entry.kind}'` });
  }
  if (!entry.content || entry.content.trim() === "") {
    details.push({ field: "content", reason: "must be non-empty" });
  }
  if (
    typeof entry.confidence !== "number" ||
    entry.confidence < 0 ||
    entry.confidence > 1
  ) {
    details.push({
      field: "confidence",
      reason: "must be a number in [0, 1]",
    });
  }
  if (typeof entry.timestamp !== "number" || entry.timestamp < 0) {
    details.push({ field: "timestamp", reason: "must be a non-negative number" });
  }
  if (
    entry.expiresAt !== undefined &&
    (typeof entry.expiresAt !== "number" || entry.expiresAt < 0)
  ) {
    details.push({
      field: "expiresAt",
      reason: "must be a non-negative number if present",
    });
  }

  if (details.length > 0) {
    return err(new ValidationError("invalid memory entry", details));
  }
  return ok(undefined);
}

/**
 * Construct a `MemoryEntry`. Pure: returns a fresh object. `now` is the
 * caller-supplied timestamp (typically from the runtime clock).
 */
export function createMemoryEntry(input: {
  readonly id: string;
  readonly kind: MemoryEntryKind;
  readonly content: string;
  readonly confidence: number;
  readonly now: number;
  readonly expiresAt?: number;
}): MemoryEntry {
  const entry: MemoryEntry = {
    id: input.id,
    kind: input.kind,
    content: input.content,
    confidence: input.confidence,
    timestamp: input.now,
  };
  if (input.expiresAt !== undefined) {
    (entry as { expiresAt?: number }).expiresAt = input.expiresAt;
  }
  return entry;
}
