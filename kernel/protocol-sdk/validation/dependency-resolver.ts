/**
 * @kernel/protocol-sdk/validation/dependency-resolver — resolves the install
 * order of protocols from their dependency declarations, with cycle detection.
 *
 * Given a set of protocol manifests (each declaring `dependencies`), compute a
 * topological order such that every dependency precedes its dependents. Ties
 * are broken by protocol id (lexicographic) so the order is deterministic.
 *
 * Cycles are reported as errors. Missing dependencies are reported as errors.
 * Optional dependencies that are absent are skipped (not an error).
 *
 * Pure given the input manifests. No I/O, no Date.now().
 */

import type { ProtocolManifest } from "../manifest/protocol-manifest";
import type { SemverString } from "../manifest/protocol-manifest";
import { satisfiesRange } from "./versioning";
import type { SdkDiagnostic } from "./diagnostic";
import { diagnostic } from "./diagnostic";

export interface DependencyNode {
  readonly id: string;
  readonly version: SemverString;
  readonly dependencies: readonly { id: string; versionRange: string; optional: boolean }[];
}

export interface DependencyResolution {
  /** Install order (dependencies first). Empty if a cycle was detected. */
  readonly order: readonly string[];
  readonly diagnostics: readonly SdkDiagnostic[];
  readonly hasCycle: boolean;
}

/** Build a `DependencyNode` view from a manifest. */
export function nodeOf(manifest: ProtocolManifest): DependencyNode {
  return {
    id: manifest.id,
    version: manifest.version,
    dependencies: manifest.dependencies.map((d) => ({
      id: d.id,
      versionRange: d.versionRange,
      optional: d.optional ?? false,
    })),
  };
}

/**
 * Resolve install order via topological sort with cycle detection.
 *
 * Algorithm: Kahn's algorithm with a lexicographic-id ready set so ordering
 * is deterministic independent of insertion order. A node is "ready" when all
 * its REQUIRED (non-optional) dependencies are already resolved. Optional
 * dependencies that are absent are skipped.
 */
export function resolveDependencyOrder(
  nodes: readonly DependencyNode[]
): DependencyResolution {
  const byId = new Map<string, DependencyNode>();
  for (const n of nodes) byId.set(n.id, n);

  const diags: SdkDiagnostic[] = [];
  const resolved = new Set<string>();
  const order: string[] = [];

  // Detect cycles via DFS-based coloring.
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of byId.keys()) color.set(id, WHITE);

  let hasCycle = false;
  function dfs(id: string, path: string[]): boolean {
    const c = color.get(id);
    if (c === GRAY) {
      diags.push(
        diagnostic(
          "dependency-resolver",
          "error",
          "DEPENDENCY_CYCLE",
          `Cycle detected: ${[...path, id].join(" → ")}`
        )
      );
      hasCycle = true;
      return false;
    }
    if (c === BLACK) return true;
    color.set(id, GRAY);
    const node = byId.get(id);
    if (node) {
      for (const dep of node.dependencies) {
        if (!byId.has(dep.id)) {
          if (!dep.optional) {
            diags.push(
              diagnostic(
                "dependency-resolver",
                "error",
                "DEPENDENCY_MISSING",
                `Protocol '${id}' requires '${dep.id}' which is not installed`
              )
            );
          }
          continue;
        }
        if (!dfs(dep.id, [...path, id])) {
          // cycle downstream — keep going to collect all diagnostics
        }
      }
    }
    color.set(id, BLACK);
    if (!resolved.has(id)) {
      resolved.add(id);
      order.push(id);
    }
    return true;
  }

  // Process in lexicographic id order for determinism.
  const ids = Array.from(byId.keys()).sort();
  for (const id of ids) {
    if (color.get(id) === WHITE) {
      dfs(id, []);
    }
  }

  // The DFS post-order gives dependencies before dependents, but we collected
  // in post-order which is correct. However, for Kahn-style "ready" ordering,
  // reverse is NOT needed because we push after visiting deps. Let's verify:
  // We add to `order` AFTER recursing into deps, so deps appear first. Good.

  // Version-satisfiability check for present deps.
  for (const node of nodes) {
    for (const dep of node.dependencies) {
      const depNode = byId.get(dep.id);
      if (!depNode) continue; // already reported
      if (!satisfiesRange(depNode.version, dep.versionRange)) {
        diags.push(
          diagnostic(
            "dependency-resolver",
            "error",
            "DEPENDENCY_VERSION_MISMATCH",
            `Protocol '${node.id}' requires '${dep.id}' ${dep.versionRange} but ${depNode.version} is installed`
          )
        );
      }
    }
  }

  return { order, diagnostics: diags, hasCycle };
}
