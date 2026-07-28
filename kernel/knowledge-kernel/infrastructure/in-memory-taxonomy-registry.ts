/**
 * @kernel/knowledge-kernel/infrastructure/in-memory-taxonomy-registry — the
 * in-memory `TaxonomyRegistry` implementation.
 *
 * Pure data structures:
 *   - `Map<TaxonomyId, Taxonomy>` — canonical taxonomy records
 *   - `Map<TaxonomyId, Map<string, TaxonomyNode>>` — per-taxonomy node lookup
 *     by id (built via DFS pre-order from `root`)
 *   - `Map<TaxonomyId, Map<string, TaxonomyNode>>` — per-taxonomy node lookup
 *     by code (when supplied)
 *
 * The `Taxonomy` primitive stores a single `root: TaxonomyNode`. Children
 * are not directly modelled on the primitive — we treat `TaxonomyNode` as
 * having an implicit `children: TaxonomyNode[]` field that callers may
 * attach at registration time. To keep the primitive frozen, we read
 * `(node as any).children` defensively; if absent, the registry treats the
 * node as a leaf.
 *
 * No `Date.now()`, no `Math.random()`. `findNode` returns the first node
 * (DFS pre-order) whose `code` matches. `getPath` returns the path from
 * root to `nodeId` inclusive, root-first.
 */

import type { TaxonomyId } from "@kernel/shared-kernel";
import type { Taxonomy, TaxonomyNode } from "@kernel/shared-kernel";
import type { TaxonomyRegistry } from "../domain";

/**
 * The shape we use internally to access children — the `TaxonomyNode`
 * primitive does not declare `children` (it is implicit), so callers may
 * attach a `children: TaxonomyNode[]` array at construction. We read it
 * defensively here.
 */
interface TaxonomyNodeWithChildren extends TaxonomyNode {
  readonly children?: readonly TaxonomyNode[];
}

function extractChildren(node: TaxonomyNode): readonly TaxonomyNode[] {
  const withChildren = node as TaxonomyNodeWithChildren;
  return withChildren.children ?? [];
}

export class InMemoryTaxonomyRegistry implements TaxonomyRegistry {
  private readonly taxonomies = new Map<TaxonomyId, Taxonomy>();
  private readonly nodeByIdMaps = new Map<
    TaxonomyId,
    Map<string, TaxonomyNode>
  >();
  private readonly nodeByCodeMaps = new Map<
    TaxonomyId,
    Map<string, TaxonomyNode>
  >();
  private readonly parentMaps = new Map<
    TaxonomyId,
    Map<string, string | undefined>
  >();

  register(taxonomy: Taxonomy): void {
    this.taxonomies.set(taxonomy.id, taxonomy);
    const byId = new Map<string, TaxonomyNode>();
    const byCode = new Map<string, TaxonomyNode>();
    const parents = new Map<string, string | undefined>();
    this.indexSubtree(taxonomy.id, taxonomy.root, undefined, byId, byCode, parents);
    this.nodeByIdMaps.set(taxonomy.id, byId);
    this.nodeByCodeMaps.set(taxonomy.id, byCode);
    this.parentMaps.set(taxonomy.id, parents);
  }

  get(id: TaxonomyId): Taxonomy | undefined {
    return this.taxonomies.get(id);
  }

  list(): readonly Taxonomy[] {
    return Array.from(this.taxonomies.values());
  }

  findNode(taxonomyId: TaxonomyId, code: string): TaxonomyNode | undefined {
    return this.nodeByCodeMaps.get(taxonomyId)?.get(code);
  }

  getPath(taxonomyId: TaxonomyId, nodeId: string): readonly TaxonomyNode[] {
    const byId = this.nodeByIdMaps.get(taxonomyId);
    const parents = this.parentMaps.get(taxonomyId);
    if (!byId || !parents) return [];
    if (!byId.has(nodeId)) return [];
    // Walk parents up to root, then reverse.
    const chain: TaxonomyNode[] = [];
    let cur: string | undefined = nodeId;
    const seen = new Set<string>();
    while (cur !== undefined && !seen.has(cur)) {
      seen.add(cur);
      const node = byId.get(cur);
      if (!node) break;
      chain.push(node);
      cur = parents.get(cur);
    }
    chain.reverse();
    return chain;
  }

  private indexSubtree(
    taxonomyId: TaxonomyId,
    node: TaxonomyNode,
    parentId: string | undefined,
    byId: Map<string, TaxonomyNode>,
    byCode: Map<string, TaxonomyNode>,
    parents: Map<string, string | undefined>
  ): void {
    byId.set(node.id, node);
    parents.set(node.id, parentId);
    if (node.code !== undefined) {
      byCode.set(node.code, node);
    }
    for (const child of extractChildren(node)) {
      this.indexSubtree(taxonomyId, child, node.id, byId, byCode, parents);
    }
  }
}
