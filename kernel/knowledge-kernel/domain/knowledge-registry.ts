/**
 * @kernel/knowledge-kernel/domain/knowledge-registry — the KnowledgeRegistry
 * PORT. THE key registry of the Knowledge Kernel.
 *
 * Every knowledge artifact (fact, procedure, standard, regulation,
 * guideline, rule, constraint) is a `KnowledgeItem` with a `kind`
 * discriminator. The Knowledge Registry is the SOLE source of truth for the
 * canonical `KnowledgeItem` record — its version, status, applicability,
 * evidence, confidence, provenance, and (optional) owning protocol.
 *
 * The kernel owns:
 *   - storage       — Map<id, version[]>
 *   - versioning    — `getVersion(id, version)` retrieves historical records
 *   - provenance    — `ProvenanceRef` on every item (frozen from primitives)
 *   - confidence    — caller-supplied `[0, 1]`, used for ranking
 *   - applicability — `Applicability` (subjectKind/subjectId + tags)
 *   - lifecycle     — `supersede` / `retire` mark items as no longer active
 *
 * THE key query method is `query(KnowledgeQuery)`: it filters by
 *   status === "active"  AND  supersededBy === undefined  AND
 *   applicability tags match (when supplied)                  AND
 *   applicability subjectKind/subjectId match (when supplied) AND
 *   kind ∈ kinds (when supplied)
 * and returns items sorted by confidence DESC, then id lexicographic ASC
 * (the determinism anchor).
 *
 * Protocols REGISTER knowledge items via `register`; the kernel owns their
 * lifecycle. An item carries an optional `ownerProtocolId` so a protocol can
 * register knowledge and later ask "what did I register?" via
 * `listByOwnerProtocol`.
 *
 * Determinism rule: pure interface — no `Date.now()`, no `Math.random()`.
 * All time flows through the `now` argument supplied to `supersede` /
 * `retire` and to `query`.
 */

import type { KnowledgeItemId } from "@kernel/shared-kernel";
import type {
  KnowledgeItem,
  KnowledgeKind,
} from "@kernel/shared-kernel";

/**
 * A query against the Knowledge Registry. Pure data.
 *
 *   `subjectKind` — optional applicability filter (e.g. `"material"`,
 *                   `"procedure"`, `"resource-type"`).
 *   `subjectId`   — optional applicability filter (e.g. `"marble"`).
 *   `tags`        — optional applicability tag filter. When supplied, every
 *                   tag must be present in the item's `applicability.tags`
 *                   (subset match). Items with empty `applicability.tags`
 *                   only match a query with no tags.
 *   `kinds`       — optional `KnowledgeKind` filter. When supplied, the
 *                   item's `kind` must be in the list.
 *   `now`         — clock-sourced epoch-millis. Used only as the time at
 *                   which the query is evaluated (currently informational;
 *                   future extensions may gate by effective/expires windows
 *                   on the item's sources).
 */
export interface KnowledgeQuery {
  readonly subjectKind?: string;
  readonly subjectId?: string;
  readonly tags?: readonly string[];
  readonly kinds?: readonly KnowledgeKind[];
  readonly now: number;
}

/**
 * The KnowledgeRegistry PORT.
 *
 * Implementations MUST be pure functions of `(id, …, now)`. Items are
 * immutable per version; the registry stores a version chain per id and
 * `get(id)` returns the latest version.
 */
export interface KnowledgeRegistry {
  /**
   * Registers (or replaces) a knowledge item. If an item with the same
   * `(id, version)` already exists, it is replaced in place. Otherwise the
   * item is appended to the version chain for `id`. After register, `get(id)`
   * returns the highest-version entry.
   */
  register(item: KnowledgeItem): void;
  /** Removes the entire version chain for `id`. No-op if unknown. */
  unregister(id: KnowledgeItemId): void;
  /**
   * Returns the LATEST version of the item, or `undefined` if unknown.
   * "Latest" = highest `version` number.
   */
  get(id: KnowledgeItemId): KnowledgeItem | undefined;
  /**
   * Returns the item at the given `version`, or `undefined` if no such
   * version exists for `id`. Used for historical replay / audit.
   */
  getVersion(id: KnowledgeItemId, version: number): KnowledgeItem | undefined;
  /**
   * Returns the latest version of every registered item (one entry per id,
   * highest version). Insertion order.
   */
  list(): readonly KnowledgeItem[];
  /**
   * Returns the latest version of every item whose `kind` matches, sorted by
   * id lexicographic.
   */
  listByKind(kind: KnowledgeKind): readonly KnowledgeItem[];
  /**
   * Returns the latest version of every item whose `applicability.tags`
   * contains `tag`, sorted by id lexicographic.
   */
  listByTag(tag: string): readonly KnowledgeItem[];
  /**
   * Returns the latest version of every item whose `ownerProtocolId` matches,
   * sorted by id lexicographic. This is how a protocol asks "what knowledge
   * did I register?".
   */
  listByOwnerProtocol(protocolId: string): readonly KnowledgeItem[];
  /**
   * THE key query. Filters by:
   *   status === "active"  AND  supersededBy === undefined  AND
   *   applicability subjectKind matches (when supplied)  AND
   *   applicability subjectId matches (when supplied)    AND
   *   applicability tags match (when supplied)            AND
   *   kind ∈ kinds (when supplied)
   * Returns items sorted by confidence DESC, then id lexicographic ASC.
   */
  query(query: KnowledgeQuery): readonly KnowledgeItem[];
  /**
   * Marks `oldId` as superseded by `newId`. Produces a new version of the
   * old item with `status = "superseded"`, `supersededBy = newId`,
   * `updatedAt = now`. The new item MUST already be registered separately
   * by the caller (via `register`). No-op if `oldId` is unknown.
   */
  supersede(
    oldId: KnowledgeItemId,
    newId: KnowledgeItemId,
    now: number
  ): void;
  /**
   * Marks `id` as retired. Produces a new version with `status = "retired"`,
   * `updatedAt = now`. No-op if `id` is unknown.
   */
  retire(id: KnowledgeItemId, now: number): void;
}
