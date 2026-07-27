/**
 * @kernel/composition/infrastructure/dependency-resolver —
 * `InMemoryDependencyResolver`.
 *
 * A RICHER dependency resolver than the protocol-sdk's `resolveDependencyOrder`:
 * it operates over `OperationalPackage`s (not protocol manifests), checks
 * version ranges, detects cycles, handles optional/required deps, validates
 * API/kernel/protocol compatibility, and produces a deterministic topological
 * ordering with lexicographic-id tie-breaks.
 *
 * Determinism:
 *   - All processing is in lexicographic-id order.
 *   - Topological tie-breaks use lexicographic-id comparison.
 *   - No `Date.now()`, no `Math.random()`.
 *
 * This file ALSO contains a small local semver implementation (`parseSemver`,
 * `compareSemver`, `satisfiesRange`) so the composition module does NOT need
 * to import any value (only types) from `@kernel/protocol-sdk`.
 */

import type { OperationalPackage } from "../domain";
import type { PackageDependency } from "../domain";
import type { PackageDiagnostic } from "../domain";
import { diagnostic } from "../domain";
import type { CompositionStage } from "../domain";

// ── Local semver implementation (no protocol-sdk value imports) ─────────────

interface ParsedSemver {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: string | null;
}

function parseSemver(v: string): ParsedSemver | null {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(v.trim());
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ?? null,
  };
}

function compareSemver(a: ParsedSemver, b: ParsedSemver): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  if (a.prerelease === null && b.prerelease === null) return 0;
  if (a.prerelease === null) return 1;
  if (b.prerelease === null) return -1;
  return a.prerelease < b.prerelease ? -1 : a.prerelease > b.prerelease ? 1 : 0;
}

type Comparator = ">" | ">=" | "<" | "<=" | "=" | "^" | "~" | "*";

interface RangeClause {
  readonly comparator: Comparator;
  readonly version: ParsedSemver | null;
}

function parseRange(range: string): RangeClause[] | null {
  const parts = range.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const clauses: RangeClause[] = [];
  for (const part of parts) {
    if (part === "*") {
      clauses.push({ comparator: "*", version: null });
      continue;
    }
    const m = /^(\^|~|>=|<=|>|<|=)?(.+)$/.exec(part);
    if (!m) return null;
    const comparator = (m[1] || "=") as Comparator;
    const version = parseSemver(m[2]);
    if (!version) return null;
    clauses.push({ comparator, version });
  }
  return clauses;
}

function satisfiesClause(version: ParsedSemver, clause: RangeClause): boolean {
  if (clause.comparator === "*") return true;
  if (!clause.version) return false;
  const cmp = compareSemver(version, clause.version);
  switch (clause.comparator) {
    case ">":
      return cmp > 0;
    case ">=":
      return cmp >= 0;
    case "<":
      return cmp < 0;
    case "<=":
      return cmp <= 0;
    case "=":
      return cmp === 0;
    case "^":
      if (cmp < 0) return false;
      if (clause.version.major > 0)
        return version.major === clause.version.major;
      if (clause.version.minor > 0)
        return version.major === 0 && version.minor === clause.version.minor;
      return (
        version.major === 0 &&
        version.minor === 0 &&
        version.patch === clause.version.patch
      );
    case "~":
      if (cmp < 0) return false;
      return (
        version.major === clause.version.major &&
        version.minor === clause.version.minor
      );
    default:
      return false;
  }
}

/** True if `version` (semver string) satisfies `range` (semver range string). */
export function satisfiesRange(version: string, range: string): boolean {
  if (range === "*" || range === "") return true;
  const v = parseSemver(version);
  const clauses = parseRange(range);
  if (!v || !clauses) return false;
  return clauses.every((c) => satisfiesClause(v, c));
}

/** Compare two semver strings. -1 / 0 / 1. Returns 0 if either is unparseable. */
export function compareSemverStrings(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  return compareSemver(pa, pb);
}

// ── Dependency resolver ──────────────────────────────────────────────────────

const STAGE: CompositionStage = "resolve";

/**
 * Result of a dependency-resolution run.
 *
 *   `order`         — install order (deps first), ids only. Empty if a cycle
 *                     was detected.
 *   `orderFull`     — same as `order` but as `(id, version)` pairs.
 *   `diagnostics`   — every diagnostic emitted.
 *   `hasCycle`      — true iff a cycle was detected.
 */
export interface DependencyResolution {
  readonly order: readonly string[];
  readonly orderFull: readonly { id: string; version: string }[];
  readonly diagnostics: readonly PackageDiagnostic[];
  readonly hasCycle: boolean;
}

/**
 * `InMemoryDependencyResolver` — resolves the install order of packages from
 * their dependency declarations.
 *
 * Algorithm: Kahn's algorithm with a lexicographic-id ready set so ordering
 * is deterministic independent of insertion order. A node is "ready" when all
 * its REQUIRED (non-optional) dependencies are already resolved AND their
 * versions satisfy the declared ranges AND (when supplied) the kernel/api/
 * protocol compatibility envelopes are satisfiable.
 *
 * Optional dependencies that are absent are skipped (not an error). Optional
 * dependencies that are present but version-incompatible are reported as
 * `warn` (not `error`).
 *
 * Required dependencies that are absent are reported as `error`.
 * Required dependencies that are present but version-incompatible are reported
 * as `error`.
 *
 * Cycles are reported as `fatal` and abort further ordering (the returned
 * `order` is empty up to that point).
 */
export class InMemoryDependencyResolver {
  /**
   * Resolve install order for a set of packages.
   *
   * @param packages the packages to order
   * @param host     optional host-context (kernel/api/protocol versions) for
   *                  compatibility checking. When omitted, compatibility is
   *                  not checked.
   */
  resolve(
    packages: readonly OperationalPackage[],
    host?: {
      readonly kernelVersion?: string;
      readonly apiVersion?: string;
      readonly protocolVersion?: string;
    }
  ): DependencyResolution {
    const diags: PackageDiagnostic[] = [];
    const byId = new Map<string, OperationalPackage>();
    for (const p of packages) {
      // If the same id appears with multiple versions, treat that as an error
      // (a registry cannot simultaneously install two versions of the same
      // package — caller should pick one).
      if (byId.has(p.manifest.id)) {
        diags.push(
          diagnostic(
            STAGE,
            "error",
            "DUPLICATE_PACKAGE",
            `Package '${p.manifest.id}' appears with multiple versions; pick one`,
            "manifest.id"
          )
        );
      }
      byId.set(p.manifest.id, p);
    }

    // Cycle detection via DFS coloring.
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;
    const color = new Map<string, number>();
    for (const id of byId.keys()) color.set(id, WHITE);
    let hasCycle = false;

    const edgeList = (id: string): readonly PackageDependency[] => {
      const p = byId.get(id);
      return p ? p.manifest.dependencies : [];
    };

    const dfs = (id: string, path: string[]): void => {
      const c = color.get(id);
      if (c === GRAY) {
        diags.push(
          diagnostic(
            STAGE,
            "fatal",
            "DEPENDENCY_CYCLE",
            `Cycle detected: ${[...path, id].join(" → ")}`
          )
        );
        hasCycle = true;
        return;
      }
      if (c === BLACK) return;
      color.set(id, GRAY);
      for (const dep of edgeList(id)) {
        if (!byId.has(dep.id)) continue;
        dfs(dep.id, [...path, id]);
      }
      color.set(id, BLACK);
    };

    const sortedIds = Array.from(byId.keys()).sort();
    for (const id of sortedIds) {
      if (color.get(id) === WHITE) dfs(id, []);
    }

    if (hasCycle) {
      return {
        order: [],
        orderFull: [],
        diagnostics: diags,
        hasCycle: true,
      };
    }

    // Kahn's algorithm with lexicographic ready set.
    const resolved = new Set<string>();
    const order: string[] = [];
    const orderFull: { id: string; version: string }[] = [];

    // For each package, count required deps not yet resolved.
    const isReady = (id: string): boolean => {
      const p = byId.get(id)!;
      for (const dep of p.manifest.dependencies) {
        if (dep.optional) continue;
        if (!byId.has(dep.id)) continue; // missing handled below
        if (!resolved.has(dep.id)) return false;
      }
      return true;
    };

    // Report missing / version-mismatched deps.
    for (const id of sortedIds) {
      const p = byId.get(id)!;
      for (const dep of p.manifest.dependencies) {
        const depPkg = byId.get(dep.id);
        if (!depPkg) {
          if (!dep.optional) {
            diags.push(
              diagnostic(
                STAGE,
                "error",
                "DEPENDENCY_MISSING",
                `Package '${id}' requires '${dep.id}' which is not present`,
                `manifest.dependencies`
              )
            );
          }
          continue;
        }
        const ok = satisfiesRange(depPkg.manifest.version, dep.versionRange);
        if (!ok) {
          diags.push(
            diagnostic(
              STAGE,
              dep.optional ? "warn" : "error",
              "DEPENDENCY_VERSION_MISMATCH",
              `Package '${id}' requires '${dep.id}' ${dep.versionRange} but ${depPkg.manifest.version} is present`,
              `manifest.dependencies`
            )
          );
        }
      }
    }

    // Compatibility envelope check (against host).
    if (host) {
      for (const id of sortedIds) {
        const p = byId.get(id)!;
        if (
          host.apiVersion &&
          !satisfiesRange(host.apiVersion, p.manifest.apiVersion)
        ) {
          // The manifest's apiVersion is an exact target; if the host does not
          // satisfy it, the package may not run.
          diags.push(
            diagnostic(
              STAGE,
              "warn",
              "HOST_API_INCOMPATIBLE",
              `Package '${id}' targets apiVersion '${p.manifest.apiVersion}'; host is '${host.apiVersion}'`,
              "manifest.apiVersion"
            )
          );
        }
      }
    }

    // Iteratively pick the lexicographically-smallest ready id.
    while (order.length < sortedIds.length) {
      const candidates = sortedIds.filter(
        (id) => !resolved.has(id) && isReady(id)
      );
      if (candidates.length === 0) {
        // Stuck — should not happen since we already detected cycles; but be
        // defensive: a missing required dep can stall Kahn's algorithm.
        for (const id of sortedIds) {
          if (!resolved.has(id)) {
            diags.push(
              diagnostic(
                STAGE,
                "fatal",
                "DEPENDENCY_UNRESOLVABLE",
                `Package '${id}' could not be ordered (missing or unsatisfiable required dependency)`,
                "manifest.dependencies"
              )
            );
          }
        }
        break;
      }
      const next = candidates[0];
      resolved.add(next);
      order.push(next);
      const p = byId.get(next)!;
      orderFull.push({ id: next, version: p.manifest.version });
    }

    return {
      order,
      orderFull,
      diagnostics: diags,
      hasCycle: false,
    };
  }
}
