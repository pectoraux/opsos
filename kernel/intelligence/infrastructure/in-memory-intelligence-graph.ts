/**
 * @kernel/intelligence/infrastructure/in-memory-intelligence-graph —
 * `InMemoryIntelligenceGraph`.
 *
 * Map-based, queryable implementation of the `IntelligenceGraph` PORT.
 *
 * Storage:
 *   - `nodes`: `Map<string, GraphNode>` (insertion-ordered; re-adding a node
 *      with the same id replaces it in place — idempotent).
 *   - `edges`: `GraphEdge[]` (insertion-ordered; duplicates permitted — the
 *      graph models partial, possibly noisy knowledge).
 *
 * Determinism guarantees:
 *   - `getNeighbors` returns NEIGHBORS SORTED BY ID ASCENDING so traversal is
 *      reproducible regardless of insertion order.
 *   - `findPath` is a BFS that expands neighbours in id-ascending order, so the
 *      returned path is the lexicographically-smallest shortest path. Identical
 *      input → identical path.
 *   - `query` returns matching nodes SORTED BY ID ASCENDING.
 *   - `stats().nodesByKind` is a plain object keyed by kind (count 0 for
 *      absent kinds is omitted — callers should treat missing keys as 0).
 *
 * No `Date.now()` / `Math.random()`. The graph is pure data.
 */
import type {
  IntelligenceGraph,
  GraphNode,
  GraphEdge,
  GraphStats,
  GraphQuery,
} from "../domain";

export class InMemoryIntelligenceGraph implements IntelligenceGraph {
  private readonly nodes = new Map<string, GraphNode>();
  private readonly edges: GraphEdge[] = [];

  addNode(node: GraphNode): void {
    // Idempotent replace-in-place (preserves insertion position in iteration).
    this.nodes.set(node.id, node);
  }

  addEdge(edge: GraphEdge): void {
    this.edges.push(edge);
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getNeighbors(
    id: string,
    direction: "in" | "out" | "both" = "both"
  ): readonly GraphNode[] {
    const neighborIds = new Set<string>();
    for (const e of this.edges) {
      if ((direction === "out" || direction === "both") && e.from === id) {
        neighborIds.add(e.to);
      }
      if ((direction === "in" || direction === "both") && e.to === id) {
        neighborIds.add(e.from);
      }
    }
    const sorted = [...neighborIds].sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0
    );
    const out: GraphNode[] = [];
    for (const nid of sorted) {
      const n = this.nodes.get(nid);
      if (n) out.push(n);
    }
    return out;
  }

  findPath(from: string, to: string): readonly string[] {
    if (!this.nodes.has(from) || !this.nodes.has(to)) return [];
    if (from === to) return [from];
    // BFS — expand neighbours in id-ascending order for determinism.
    const visited = new Set<string>([from]);
    const queue: { id: string; path: string[] }[] = [
      { id: from, path: [from] },
    ];
    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      const neighbors = this.neighborIds(id, "out");
      for (const nid of neighbors) {
        if (visited.has(nid)) continue;
        const nextPath = [...path, nid];
        if (nid === to) return nextPath;
        visited.add(nid);
        queue.push({ id: nid, path: nextPath });
      }
    }
    return [];
  }

  query(filter: GraphQuery): readonly GraphNode[] {
    const results: GraphNode[] = [];
    for (const node of this.nodes.values()) {
      if (filter.kind !== undefined && node.kind !== filter.kind) continue;
      if (
        filter.attributes !== undefined &&
        !matchesAttributes(node.attributes, filter.attributes)
      ) {
        continue;
      }
      results.push(node);
    }
    results.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return results;
  }

  stats(): GraphStats {
    const nodesByKind: Record<string, number> = {};
    for (const n of this.nodes.values()) {
      nodesByKind[n.kind] = (nodesByKind[n.kind] ?? 0) + 1;
    }
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.length,
      nodesByKind,
    };
  }

  // ── internal helpers ──────────────────────────────────────────────────

  private neighborIds(id: string, direction: "in" | "out" | "both"): string[] {
    const set = new Set<string>();
    for (const e of this.edges) {
      if ((direction === "out" || direction === "both") && e.from === id) {
        set.add(e.to);
      }
      if ((direction === "in" || direction === "both") && e.to === id) {
        set.add(e.from);
      }
    }
    return [...set].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
}

/**
 * Shallow+deep attribute matcher: every key in `expected` must be present on
 * `actual` with a structurally-equal value. Supports primitives, arrays, and
 * nested plain objects. Functions / class instances are compared by reference
 * (and should not appear in serialisable graph attributes).
 */
function matchesAttributes(
  actual: Readonly<Record<string, unknown>>,
  expected: Readonly<Record<string, unknown>>
): boolean {
  for (const key of Object.keys(expected)) {
    if (!deepEqual(actual[key], expected[key])) return false;
  }
  return true;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (
    a !== null &&
    b !== null &&
    typeof a === "object" &&
    typeof b === "object"
  ) {
    const ak = Object.keys(a as Record<string, unknown>);
    const bk = Object.keys(b as Record<string, unknown>);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (
        !Object.prototype.hasOwnProperty.call(b, k) ||
        !deepEqual(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k]
        )
      ) {
        return false;
      }
    }
    return true;
  }
  return false;
}
