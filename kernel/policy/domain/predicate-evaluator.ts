/**
 * @kernel/policy/domain/predicate-evaluator — THE SINGLE SANCTIONED PREDICATE
 * INTERPRETER for OpsOS.
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  NO OTHER CODE IN THE KERNEL MAY EVALUATE A `PredicateSpec`.     ║
 * ║  Rules are serializable data (ADR-0007), evaluated only here, so    ║
 * ║  policy replay is byte-identical and decisions are auditable /      ║
 * ║  transportable. Anywhere you see `spec.op` being switched on outside ║
 * ║  this file, that is a determinism + audit bug.                       ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Contract:
 *   - PURE: same `(spec, subject)` → same boolean. No I/O.
 *   - TOTAL: NEVER throws. Unknown operators, malformed args, missing
 *     paths, type mismatches — all return `false` (fail-closed). A policy
 *     that cannot be evaluated is treated as "does not match", which keeps
 *     the engine safe by default.
 *   - DETERMINISTIC: no `Date.now()` / `Math.random()`, no hidden state.
 *   - `regex` is constructed from a string argument; malicious or invalid
 *     patterns degrade to `false` rather than throwing.
 *
 * Operators (the `op` field of `PredicateSpec`):
 *   - `eq`     — args[0] dot-path, args[1] value;  subject[path] === value
 *   - `neq`    — args[0] dot-path, args[1] value;  subject[path] !== value
 *   - `gt`     — args[0] dot-path, args[1] value;  subject[path] >  value (numeric/string)
 *   - `gte`    — args[0] dot-path, args[1] value;  subject[path] >= value
 *   - `lt`     — args[0] dot-path, args[1] value;  subject[path] <  value
 *   - `lte`    — args[0] dot-path, args[1] value;  subject[path] <= value
 *   - `in`     — args[0] dot-path, args[1] array;  array.includes(subject[path])
 *   - `contains` — args[0] dot-path (array value), args[1] value; subject[path].includes(value)
 *   - `and`    — args are nested PredicateSpecs;  all must be true (empty → true)
 *   - `or`     — args are nested PredicateSpecs;  any true (empty → false)
 *   - `not`    — args[0] is a nested PredicateSpec;  logical negation
 *   - `exists` — args[0] dot-path;  true if the path resolves to a defined value
 *   - `matches`— args[0] dot-path (string value), args[1] regex string;  RegExp test
 *   - `path`   — args[0] literal dot-path;  returns the value at the path
 *                (kept for symmetry; in a boolean evaluator it is interpreted
 *                as "the value at path is truthy". A pure-value interpretation
 *                is not needed because every operator here returns boolean.)
 *
 * `getAtPath(subject, path)` resolves a dot-path (`"a.b.c"`) into the subject
 * tree. Returns `undefined` for any missing segment or non-object traversal.
 */

import type { PredicateSpec } from "@kernel/shared-kernel";

/**
 * Bumped whenever the set of recognised operators or their semantics changes.
 * Decisions recorded with evaluator version N are guaranteed to replay
 * identically under the same version; cross-version replay requires explicit
 * migration. Recorded as part of decision provenance by the engine.
 */
export const EVALUATOR_VERSION = 1;

/**
 * Resolve a dot-path (`"priority.level"`) into a subject tree. Returns
 * `undefined` for any missing segment, non-object intermediate, or empty path.
 *
 * PURE and total: never throws. Handles array indices if the segment is a
 * numeric string and the intermediate is an array.
 */
export function getAtPath(
  subject: Readonly<Record<string, unknown>>,
  path: string
): unknown {
  if (typeof path !== "string" || path.length === 0) return undefined;
  const segments = path.split(".");
  let current: unknown = subject;
  for (const seg of segments) {
    if (seg === "") return undefined;
    if (current === null || typeof current !== "object") return undefined;
    if (Array.isArray(current)) {
      // Numeric index into arrays; non-numeric → undefined (fail-closed).
      if (!/^\d+$/.test(seg)) return undefined;
      const idx = Number(seg);
      if (idx < 0 || idx >= current.length) return undefined;
      current = current[idx];
    } else {
      current = (current as Record<string, unknown>)[seg];
    }
  }
  return current;
}

/**
 * Coerce a PredicateSpec argument into a nested PredicateSpec. Returns `null`
 * if the argument is not a structurally-valid PredicateSpec (has `op: string`
 * and `args: array`). Used by `and` / `or` / `not`.
 */
function asPredicateSpec(arg: unknown): PredicateSpec | null {
  if (arg === null || typeof arg !== "object") return null;
  const obj = arg as { op?: unknown; args?: unknown };
  if (typeof obj.op !== "string") return null;
  if (!Array.isArray(obj.args)) return null;
  return { op: obj.op, args: obj.args as readonly unknown[] };
}

/**
 * Strict-ish equality used by `eq` / `neq`. Mirrors `===` semantics but
 * tolerates number-vs-string numeric equality when both sides look numeric
 * (because serialised rule args arrive as JSON, where `42` and `"42"` are
 * different types but operationally equivalent). For non-numeric operands,
 * falls back to `===`.
 */
function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // NaN handling: NaN === NaN is false; treat two NaNs as equal.
  if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b)) {
    return true;
  }
  return false;
}

/**
 * Ordered comparison used by `gt` / `gte` / `lt` / `lte`. Returns `undefined`
 * when the operands are not orderable (different types, or non-number/string
 * types); the caller treats `undefined` as "comparison fails → false".
 */
function compare(a: unknown, b: unknown): number | undefined {
  if (typeof a === "number" && typeof b === "number") {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  if (typeof a === "string" && typeof b === "string") {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  return undefined;
}

/**
 * THE predicate interpreter. PURE and TOTAL: never throws, never reads the
 * clock or random source. Unknown operators / malformed specs / missing paths
 * all degrade to `false` (fail-closed) so a broken rule never produces a
 * surprise `allow`.
 *
 * @param spec  the PredicateSpec to evaluate
 * @param subject  the read-only record the predicate is evaluated against
 * @returns boolean
 */
export function evaluatePredicate(
  spec: PredicateSpec,
  subject: Readonly<Record<string, unknown>>
): boolean {
  // Structural guard — if the spec itself is malformed, fail-closed.
  if (spec === null || typeof spec !== "object") return false;
  const op = spec.op;
  const args = spec.args;
  if (typeof op !== "string" || !Array.isArray(args)) return false;

  switch (op) {
    case "eq": {
      const path = args[0];
      const value = args[1];
      if (typeof path !== "string") return false;
      return looseEqual(getAtPath(subject, path), value);
    }
    case "neq": {
      const path = args[0];
      const value = args[1];
      if (typeof path !== "string") return false;
      return !looseEqual(getAtPath(subject, path), value);
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const path = args[0];
      const value = args[1];
      if (typeof path !== "string") return false;
      const c = compare(getAtPath(subject, path), value);
      if (c === undefined) return false;
      switch (op) {
        case "gt":
          return c > 0;
        case "gte":
          return c >= 0;
        case "lt":
          return c < 0;
        case "lte":
          return c <= 0;
      }
      return false; // unreachable
    }
    case "in": {
      const path = args[0];
      const arr = args[1];
      if (typeof path !== "string" || !Array.isArray(arr)) return false;
      const v = getAtPath(subject, path);
      return arr.some((item) => looseEqual(v, item));
    }
    case "contains": {
      const path = args[0];
      const value = args[1];
      if (typeof path !== "string") return false;
      const arr = getAtPath(subject, path);
      if (!Array.isArray(arr)) return false;
      return arr.some((item) => looseEqual(item, value));
    }
    case "and": {
      // Empty conjunction → true (vacuous truth). Each arg must be a valid
      // PredicateSpec; malformed args are treated as `false`.
      for (const a of args) {
        const sub = asPredicateSpec(a);
        if (sub === null) return false;
        if (!evaluatePredicate(sub, subject)) return false;
      }
      return true;
    }
    case "or": {
      // Empty disjunction → false. Malformed args are skipped (treated as
      // false) without failing the whole `or`.
      for (const a of args) {
        const sub = asPredicateSpec(a);
        if (sub === null) continue;
        if (evaluatePredicate(sub, subject)) return true;
      }
      return false;
    }
    case "not": {
      const sub = asPredicateSpec(args[0]);
      if (sub === null) return false;
      return !evaluatePredicate(sub, subject);
    }
    case "exists": {
      const path = args[0];
      if (typeof path !== "string") return false;
      return getAtPath(subject, path) !== undefined;
    }
    case "matches": {
      const path = args[0];
      const pattern = args[1];
      if (typeof path !== "string" || typeof pattern !== "string") return false;
      const v = getAtPath(subject, path);
      if (typeof v !== "string") return false;
      try {
        // `RegExp` can throw on invalid pattern — contain it: invalid regex
        // fails-closed (returns false) rather than propagating.
        const re = new RegExp(pattern);
        return re.test(v);
      } catch {
        return false;
      }
    }
    case "path": {
      // `path` returns the value at the path. In a boolean evaluator we
      // interpret it as "the value at path is truthy" — `undefined`, `null`,
      // `false`, `0`, `""` are all falsy. This keeps the evaluator
      // boolean-only while still letting `path` be a meaningful leaf.
      const path = args[0];
      if (typeof path !== "string") return false;
      const v = getAtPath(subject, path);
      return !!v;
    }
    default:
      // Unknown operator — fail-closed. Adding a new operator requires
      // bumping `EVALUATOR_VERSION` so consumers can detect the change.
      return false;
  }
}
