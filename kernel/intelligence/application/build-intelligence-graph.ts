/**
 * @kernel/intelligence/application/build-intelligence-graph — use-case that
 * builds an IntelligenceGraph from operational data.
 *
 * The caller maps their operational reality (kernel Events, Resources,
 * Knowledge items, Domains, Capabilities, Policies, Work, Executions,
 * Outcomes, Organizations) into a flat list of `GraphNodeInput` records — each
 * carrying an id, kind, label, attributes, and a list of outgoing refs. The
 * use-case populates an injected `IntelligenceGraph` with the corresponding
 * nodes and edges.
 *
 * This keeps the application layer decoupled: it depends only on the
 * `IntelligenceGraph` PORT (domain), not on any specific kernel module. The
 * mapping from kernel primitives to `GraphNodeInput` is the caller's
 * responsibility (a thin adapter at the edge).
 *
 * Deterministic: identical input + graph → identical resulting graph state.
 * No `Date.now()` / `Math.random()`.
 */
import type {
  IntelligenceGraph,
  GraphNode,
  GraphEdge,
  GraphNodeKind,
  GraphEdgeKind,
} from "../domain";

/** An outgoing reference from a node — becomes a GraphEdge. */
export interface GraphNodeRef {
  readonly to: string;
  readonly kind: GraphEdgeKind;
  readonly weight?: number;
}

/** A node-to-add, with optional outgoing refs. */
export interface GraphNodeInput {
  readonly id: string;
  readonly kind: GraphNodeKind;
  readonly label: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly refs?: readonly GraphNodeRef[];
}

/** Input to `buildIntelligenceGraph`. */
export interface BuildIntelligenceGraphInput {
  readonly nodes: readonly GraphNodeInput[];
}

/** Deps — the graph instance to populate (dependency injection). */
export interface BuildIntelligenceGraphDeps {
  readonly graph: IntelligenceGraph;
}

/**
 * `buildIntelligenceGraph` — populates the injected graph with the given nodes
 * (and their outgoing refs as edges) and returns the graph.
 *
 * Nodes are added first, then edges, so an edge may reference a node added in
 * the same batch. Missing targets are tolerated (the edge is still recorded —
 * the graph models partial knowledge; `getNeighbors` simply returns nothing for
 * unknown ids).
 */
export function buildIntelligenceGraph(
  input: BuildIntelligenceGraphInput,
  deps: BuildIntelligenceGraphDeps
): IntelligenceGraph {
  const { graph } = deps;
  // Phase 1 — add all nodes.
  for (const n of input.nodes) {
    const node: GraphNode = {
      id: n.id,
      kind: n.kind,
      label: n.label,
      attributes: n.attributes ?? {},
    };
    graph.addNode(node);
  }
  // Phase 2 — add all edges from refs.
  for (const n of input.nodes) {
    if (!n.refs) continue;
    for (const ref of n.refs) {
      const edge: GraphEdge = {
        from: n.id,
        to: ref.to,
        kind: ref.kind,
        ...(ref.weight !== undefined ? { weight: ref.weight } : {}),
      };
      graph.addEdge(edge);
    }
  }
  return graph;
}

/**
 * `BuildIntelligenceGraph` — class form of the use-case for callers that
 * prefer instance composition.
 */
export class BuildIntelligenceGraph {
  constructor(private readonly deps: BuildIntelligenceGraphDeps) {}

  execute(input: BuildIntelligenceGraphInput): IntelligenceGraph {
    return buildIntelligenceGraph(input, this.deps);
  }
}
