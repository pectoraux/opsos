/**
 * @kernel/intelligence/domain/intelligence-graph — the IntelligenceGraph.
 *
 * The universal, cross-cutting graph that connects EVERYTHING the kernel knows
 * about: Events, Resources, Knowledge, Domains, Capabilities, Policies, Work,
 * Executions, Outcomes, and Organizations. It is the substrate that the
 * Explanation / Recommendation / Prediction / Anomaly engines read from.
 *
 * The graph is OBSERVATION-ONLY. It never mutates kernel state. Populating it
 * (adding nodes/edges) is a projection step — the graph is a derived read-model
 * of operational reality, not a source of truth.
 *
 * Node and edge kinds are FROZEN enums (additive evolution only — new kinds
 * require a new graph version, never an in-place mutation). This mirrors the
 * canonical-primitive freeze policy (ADR-0010).
 *
 * The intelligence module defines its OWN GraphNode / GraphEdge types
 * (structurally compatible with kernel primitives but self-contained) so the
 * framework stays decoupled from any single kernel module and can observe them
 * all uniformly.
 */

/** Kinds of nodes that may appear in an IntelligenceGraph. FROZEN. */
export type GraphNodeKind =
  | "event"
  | "resource"
  | "knowledge"
  | "domain"
  | "capability"
  | "policy"
  | "work"
  | "execution"
  | "outcome"
  | "organization";

/** Kinds of directed edges between graph nodes. FROZEN. */
export type GraphEdgeKind =
  | "caused"
  | "used"
  | "produced"
  | "depends-on"
  | "assigned-to"
  | "references"
  | "scheduled"
  | "violated"
  | "satisfied";

/**
 * A node in the intelligence graph. `attributes` is an opaque, serialisable
 * bag — the graph does not interpret its contents; engines that read the graph
 * may inspect specific keys they understand.
 */
export interface GraphNode {
  readonly id: string;
  readonly kind: GraphNodeKind;
  readonly label: string;
  readonly attributes: Readonly<Record<string, unknown>>;
}

/** A directed, weighted edge between two graph nodes. */
export interface GraphEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: GraphEdgeKind;
  readonly weight?: number;
}

/**
 * Filter passed to `IntelligenceGraph.query`. All present fields must match
 * (logical AND). Attribute matching is shallow: every key in `attributes` must
 * be present on the node with a deep-equal value.
 */
export interface GraphQuery {
  readonly kind?: GraphNodeKind;
  readonly attributes?: Readonly<Record<string, unknown>>;
}

/** Aggregate statistics about a graph. */
export interface GraphStats {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly nodesByKind: Readonly<Record<string, number>>;
}

/**
 * IntelligenceGraph — the universal observation graph.
 *
 * PORT: implementations live in `infrastructure/` (e.g.
 * `InMemoryIntelligenceGraph`). The graph is mutable by the builder (addNode /
 * addEdge) but read-only to every engine that consumes it.
 *
 * `findPath` returns the list of node ids on a shortest path from `from` to
 * `to` (BFS), or an empty array if no path exists. Edge direction is honoured.
 */
export interface IntelligenceGraph {
  addNode(node: GraphNode): void;
  addEdge(edge: GraphEdge): void;
  getNode(id: string): GraphNode | undefined;
  getNeighbors(
    id: string,
    direction?: "in" | "out" | "both"
  ): readonly GraphNode[];
  findPath(from: string, to: string): readonly string[];
  query(filter: GraphQuery): readonly GraphNode[];
  stats(): GraphStats;
}
