/**
 * @kernel/protocol-sdk/validation/versioning — semver parsing + range
 * satisfaction.
 *
 * A pragmatic subset of semver: parses `MAJOR.MINOR.PATCH` with optional
 * `-prerelease`. Supports range operators `^`, `~`, `>=`, `>`, `<=`, `<`,
 * exact, and space-separated AND ranges (e.g. `>=1.2.0 <2.0.0`). No OR (`||`)
 * — protocols should declare one range per dependency.
 *
 * Pure. No I/O.
 */

import type { SemverString, SemverRange } from "../manifest/protocol-manifest";

export interface ParsedSemver {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: string | null;
}

/** Parse a semver string. Returns null if unparseable. */
export function parseSemver(v: string): ParsedSemver | null {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(v.trim());
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ?? null,
  };
}

/** True if `v` is a valid semver string. */
export function isValidSemver(v: string): boolean {
  return parseSemver(v) !== null;
}

/** Compare two semvers. -1 / 0 / 1. Prerelease < release. */
export function compareSemver(a: ParsedSemver, b: ParsedSemver): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  // Prerelease: null (release) > any prerelease string.
  if (a.prerelease === null && b.prerelease === null) return 0;
  if (a.prerelease === null) return 1;
  if (b.prerelease === null) return -1;
  return a.prerelease < b.prerelease ? -1 : a.prerelease > b.prerelease ? 1 : 0;
}

type Comparator = ">" | ">=" | "<" | "<=" | "=" | "^" | "~";

interface RangeClause {
  readonly comparator: Comparator;
  readonly version: ParsedSemver;
}

/** Parse a range string into a list of AND-clauses. Returns null if unparseable. */
function parseRange(range: string): RangeClause[] | null {
  const parts = range.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const clauses: RangeClause[] = [];
  for (const part of parts) {
    const m = /^(\^|~|>=|<=|>|<|=)?(.+)$/.exec(part);
    if (!m) return null;
    const comparator = (m[1] || "=") as Comparator;
    const version = parseSemver(m[2]);
    if (!version) return null;
    clauses.push({ comparator, version });
  }
  return clauses;
}

/** True if `version` satisfies a single clause. */
function satisfiesClause(version: ParsedSemver, clause: RangeClause): boolean {
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
      // ^1.2.3 := >=1.2.3 <2.0.0 (major pin); ^0.2.3 := >=0.2.3 <0.3.0; ^0.0.3 := >=0.0.3 <0.0.4
      if (cmp < 0) return false;
      if (clause.version.major > 0) {
        return version.major === clause.version.major;
      }
      if (clause.version.minor > 0) {
        return (
          version.major === 0 && version.minor === clause.version.minor
        );
      }
      return (
        version.major === 0 &&
        version.minor === 0 &&
        version.patch === clause.version.patch
      );
    case "~":
      // ~1.2.3 := >=1.2.3 <1.3.0
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
export function satisfiesRange(version: string, range: SemverRange): boolean {
  const v = parseSemver(version);
  const clauses = parseRange(range);
  if (!v || !clauses) return false;
  return clauses.every((c) => satisfiesClause(v, c));
}
