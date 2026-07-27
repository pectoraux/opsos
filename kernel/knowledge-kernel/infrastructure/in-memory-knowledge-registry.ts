/**
 * @kernel/knowledge-kernel/infrastructure/in-memory-knowledge-registry — the
 * in-memory `KnowledgeRegistry` implementation. THE key registry.
 *
 * Pure data structures:
 *   - `Map<KnowledgeItemId, KnowledgeItem[]>` — version chain per id,
 *     sorted ascending by `version`. `get(id)` returns the LAST entry
 *     (highest version). `getVersion(id, v)` returns the entry with
 *     `version === v`.
 *   - `Map<KnowledgeKind, Set<KnowledgeItemId>>` — kind → id index
 *   - `Map<string, Set<KnowledgeItemId>>` — tag → id index
 *   - `Map<string, Set<KnowledgeItemId>>` — ownerProtocolId → id index
 *
 * Lifecycle:
 *   - `register(item)` — if a version chain exists for `item.id`, the new
 *     item is appended (replacing an existing entry with the same `version`
 *     in place); otherwise a new chain is started. The kind/tag/owner
 *     indices are updated for the latest version.
 *   - `supersede(oldId, newId, now)` — produces a new version of `oldId`
 *     with `status="superseded"`, `supersededBy=newId`, `updatedAt=now`,
 *     and appends it to the version chain. The kind/tag/owner indices are
 *     NOT updated (the item is no longer active; queries filter it out by
 *     status).
 *   - `retire(id, now)` — produces a new version with `status="retired"`,
 *     `updatedAt=now`, and appends it to the version chain.
 *
 * `query` filtering:
 *   - status === "active"  AND  supersededBy === undefined
 *   - if `kinds` supplied: kind ∈ kinds
 *   - if `subjectKind` supplied: applicability.subjectKind === undefined OR
 *     applicability.subjectKind === subjectKind
 *   - if `subjectId` supplied: applicability.subjectId === undefined OR
 *     applicability.subjectId === subjectId
 *   - if `tags` supplied: every tag is in applicability.tags (subset match)
 *
 * Sort: confidence DESC, then id lexicographic ASC.
 *
 * No `Date.now()`, no `Math.random()`.
 */

import type { KnowledgeItemId } from "@kernel/shared-kernel";
import type {
  KnowledgeItem,
  KnowledgeKind,
} from "@kernel/shared-kernel";
import type {
  KnowledgeRegistry,
  KnowledgeQuery,
} from "../domain";

export class InMemoryKnowledgeRegistry implements KnowledgeRegistry {
  private readonly chains = new Map<KnowledgeItemId, KnowledgeItem[]>();
  private readonly byKind = new Map<KnowledgeKind, Set<KnowledgeItemId>>();
  private readonly byTag = new Map<string, Set<KnowledgeItemId>>();
  private readonly byOwner = new Map<string, Set<KnowledgeItemId>>();

  register(item: KnowledgeItem): void {
    let chain = this.chains.get(item.id);
    if (!chain) {
      chain = [];
      this.chains.set(item.id, chain);
    }
    // Replace existing version in place, or append.
    const idx = chain.findIndex((it) => it.version === item.version);
    if (idx >= 0) {
      chain[idx] = item;
    } else {
      chain.push(item);
      chain.sort((a, b) => a.version - b.version);
    }
    // If this is the latest version, refresh the secondary indices.
    const latest = chain[chain.length - 1];
    if (latest === item) {
      this.reindex(item);
    }
  }

  unregister(id: KnowledgeItemId): void {
    const chain = this.chains.get(id);
    if (!chain) return;
    // Remove from secondary indices based on the latest version.
    const latest = chain[chain.length - 1];
    this.removeFromIndices(latest);
    this.chains.delete(id);
  }

  get(id: KnowledgeItemId): KnowledgeItem | undefined {
    const chain = this.chains.get(id);
    if (!chain || chain.length === 0) return undefined;
    return chain[chain.length - 1];
  }

  getVersion(id: KnowledgeItemId, version: number): KnowledgeItem | undefined {
    const chain = this.chains.get(id);
    if (!chain) return undefined;
    return chain.find((it) => it.version === version);
  }

  list(): readonly KnowledgeItem[] {
    const out: KnowledgeItem[] = [];
    for (const chain of this.chains.values()) {
      if (chain.length > 0) out.push(chain[chain.length - 1]);
    }
    return out;
  }

  listByKind(kind: KnowledgeKind): readonly KnowledgeItem[] {
    const set = this.byKind.get(kind);
    if (!set) return [];
    const out: KnowledgeItem[] = [];
    for (const id of set) {
      const item = this.get(id);
      if (item) out.push(item);
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  listByTag(tag: string): readonly KnowledgeItem[] {
    const set = this.byTag.get(tag);
    if (!set) return [];
    const out: KnowledgeItem[] = [];
    for (const id of set) {
      const item = this.get(id);
      if (item) out.push(item);
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  listByOwnerProtocol(protocolId: string): readonly KnowledgeItem[] {
    const set = this.byOwner.get(protocolId);
    if (!set) return [];
    const out: KnowledgeItem[] = [];
    for (const id of set) {
      const item = this.get(id);
      if (item) out.push(item);
    }
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  }

  query(query: KnowledgeQuery): readonly KnowledgeItem[] {
    const out: KnowledgeItem[] = [];
    const kinds = query.kinds ? new Set(query.kinds) : undefined;
    const tags = query.tags ? new Set(query.tags) : undefined;

    for (const chain of this.chains.values()) {
      if (chain.length === 0) continue;
      const item = chain[chain.length - 1];
      if (item.status !== "active") continue;
      if (item.supersededBy !== undefined) continue;
      if (kinds && !kinds.has(item.kind)) continue;
      if (query.subjectKind !== undefined) {
        const isk = item.applicability.subjectKind;
        if (isk !== undefined && isk !== query.subjectKind) continue;
      }
      if (query.subjectId !== undefined) {
        const isid = item.applicability.subjectId;
        if (isid !== undefined && isid !== query.subjectId) continue;
      }
      if (tags) {
        const itemTags = item.applicability.tags;
        let allMatch = true;
        for (const t of tags) {
          if (!itemTags.includes(t)) {
            allMatch = false;
            break;
          }
        }
        if (!allMatch) continue;
      }
      out.push(item);
    }

    // Sort by confidence DESC, then id lexicographic ASC.
    out.sort((a, b) => {
      if (a.confidence !== b.confidence) return b.confidence - a.confidence;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return out;
  }

  supersede(
    oldId: KnowledgeItemId,
    newId: KnowledgeItemId,
    now: number
  ): void {
    const chain = this.chains.get(oldId);
    if (!chain || chain.length === 0) return;
    const old = chain[chain.length - 1];
    const next: KnowledgeItem = {
      ...old,
      status: "superseded",
      supersededBy: newId,
      updatedAt: now,
    };
    // The superseded version is a NEW version entry. We use `old.version + 1`
    // so `getVersion(oldId, old.version)` still returns the original active
    // record.
    const newVersion = old.version + 1;
    (next as { version: number }).version = newVersion;
    chain.push(next);
    // The secondary indices continue to point at `oldId` (the id, not the
    // version). `get(oldId)` now returns the superseded record; `query`
    // filters it out by status.
  }

  retire(id: KnowledgeItemId, now: number): void {
    const chain = this.chains.get(id);
    if (!chain || chain.length === 0) return;
    const cur = chain[chain.length - 1];
    const next: KnowledgeItem = {
      ...cur,
      status: "retired",
      updatedAt: now,
    };
    const newVersion = cur.version + 1;
    (next as { version: number }).version = newVersion;
    chain.push(next);
  }

  // ── Index maintenance ────────────────────────────────────────────────────

  private reindex(item: KnowledgeItem): void {
    // Kind index.
    let kindSet = this.byKind.get(item.kind);
    if (!kindSet) {
      kindSet = new Set();
      this.byKind.set(item.kind, kindSet);
    }
    kindSet.add(item.id);
    // Tag index.
    for (const tag of item.applicability.tags) {
      let tagSet = this.byTag.get(tag);
      if (!tagSet) {
        tagSet = new Set();
        this.byTag.set(tag, tagSet);
      }
      tagSet.add(item.id);
    }
    // Owner-protocol index.
    if (item.ownerProtocolId) {
      let ownerSet = this.byOwner.get(item.ownerProtocolId);
      if (!ownerSet) {
        ownerSet = new Set();
        this.byOwner.set(item.ownerProtocolId, ownerSet);
      }
      ownerSet.add(item.id);
    }
  }

  private removeFromIndices(item: KnowledgeItem): void {
    const kindSet = this.byKind.get(item.kind);
    if (kindSet) kindSet.delete(item.id);
    for (const tag of item.applicability.tags) {
      const tagSet = this.byTag.get(tag);
      if (tagSet) tagSet.delete(item.id);
    }
    if (item.ownerProtocolId) {
      const ownerSet = this.byOwner.get(item.ownerProtocolId);
      if (ownerSet) ownerSet.delete(item.id);
    }
  }
}
