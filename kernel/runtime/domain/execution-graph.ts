/**
 * @kernel/runtime/domain/execution-graph — the deterministic DAG of operations.
 *
 * An `ExecutionGraph` is the unit of work the `RuntimeExecutor` runs. Nodes
 * reference registered `OperationHandler`s by `(name, version)`; edges and
 * `dependsOn` together define the partial order. The `seed` is the determinism
 * anchor: two executions of the same graph with the same seed and the same
 * input state produce byte-identical results.
 *
 * `topologicalOrder` is the canonical, deterministic ordering function used by
 * the executor. Ties are broken by **lexicographic node-id order**, NEVER by
 * insertion timing — this is what makes ordering reproducible across runs and
 * across machines. Cycles are reported as `DeterminismViolationError`.
 */

import type {
  Result,
  KernelError,
} from "@kernel/shared-kernel";
import { ok, err, DeterminismViolationError } from "@kernel/shared-kernel";
import type { OperationRef } from "./operation";

/** Lifecycle of a node within a single execution. */
export type NodeStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

/** A single operation invocation in the graph. */
export interface ExecutionNode {
  readonly id: string;
  /** References a registered `OperationHandler`. */
  readonly operation: OperationRef;
  readonly inputs: Readonly<Record<string, unknown>>;
  /** Node ids that must complete before this node may run. */
  readonly dependsOn: readonly string[];
}

/** A directed dependency edge `from → to` (`to` depends on `from`). */
export interface ExecutionEdge {
  readonly from: string;
  readonly to: string;
}

/** The deterministic execution unit. */
export interface ExecutionGraph {
  readonly id: string;
  readonly nodes: readonly ExecutionNode[];
  readonly edges: readonly ExecutionEdge[];
  /** Determinism anchor; flows into the seeded `RandomSource` if the runtime chooses. */
  readonly seed: number;
}

const LEXICO = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Binary-insert `value` into a lexicographically-sorted `arr`. Pure helper. */
function insertSorted(arr: string[], value: string): void {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid]! < value) lo = mid + 1;
    else hi = mid;
  }
  arr.splice(lo, 0, value);
}

/**
 * Compute the deterministic topological order of `graph`'s node ids.
 *
 * Algorithm: Kahn's algorithm with a **lexicographic tie-break**. At every
 * step the node with the smallest id (by `String` comparison) among those
 * whose in-degree has reached zero is emitted next. This is independent of
 * insertion order, map iteration order, and host machine.
 *
 * Both `node.dependsOn` and `graph.edges` contribute dependencies (their
 * union defines the DAG). Unknown references and duplicate node ids are
 * reported as `DeterminismViolationError`. A cycle is likewise reported as a
 * `DeterminismViolationError`.
 */
export function topologicalOrder(
  graph: ExecutionGraph
): Result<readonly string[], KernelError> {
  const ids: string[] = [];
  const idSet = new Set<string>();
  for (const n of graph.nodes) {
    if (idSet.has(n.id)) {
      return err(
        new DeterminismViolationError(
          `Duplicate node id '${n.id}' in graph '${graph.id}'`
        )
      );
    }
    idSet.add(n.id);
    ids.push(n.id);
  }

  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const id of ids) {
    indeg.set(id, 0);
    adj.set(id, []);
  }

  const addEdge = (from: string, to: string): boolean => {
    if (!idSet.has(from) || !idSet.has(to)) return false;
    adj.get(from)!.push(to);
    indeg.set(to, (indeg.get(to) ?? 0) + 1);
    return true;
  };

  for (const node of graph.nodes) {
    for (const dep of node.dependsOn) {
      if (!addEdge(dep, node.id)) {
        return err(
          new DeterminismViolationError(
            `Node '${node.id}' in graph '${graph.id}' depends on unknown node '${dep}'`
          )
        );
      }
    }
  }
  for (const edge of graph.edges) {
    if (!addEdge(edge.from, edge.to)) {
      return err(
        new DeterminismViolationError(
          `Edge '${edge.from}' -> '${edge.to}' in graph '${graph.id}' references unknown node`
        )
      );
    }
  }

  // Kahn's algorithm with lexicographic ordering of the ready set.
  const ready: string[] = [];
  for (const id of ids) {
    if ((indeg.get(id) ?? 0) === 0) ready.push(id);
  }
  ready.sort(LEXICO);

  const order: string[] = [];
  while (ready.length > 0) {
    const next = ready.shift()!;
    order.push(next);
    for (const succ of adj.get(next) ?? []) {
      const d = (indeg.get(succ) ?? 0) - 1;
      indeg.set(succ, d);
      if (d === 0) {
        insertSorted(ready, succ);
      }
    }
  }

  if (order.length !== ids.length) {
    return err(
      new DeterminismViolationError(
        `Cycle detected in execution graph '${graph.id}'; ${ids.length - order.length} node(s) unreachable`
      )
    );
  }

  return ok(order as readonly string[]);
}
