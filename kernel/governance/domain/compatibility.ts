/**
 * @kernel/governance/domain/compatibility — the compatibility contract.
 *
 * Compatibility is the platform's answer to "may these two artifacts coexist?".
 * It is ALWAYS a relationship between a `source` and a `target` along a named
 * `dimension`. The five dimensions cover every compatibility question OpsOS
 * needs to answer:
 *
 *   - `protocol-kernel`:     does this protocol version run on this kernel version?
 *   - `package-application`: does this package version satisfy this application's dependency?
 *   - `application-domain`:  does this application version target this domain version?
 *   - `protocol-knowledge`:  does this protocol version reference this knowledge-pack version?
 *   - `protocol-compiler`:   does this protocol version expect this compiler version?
 *
 * The engine is DETERMINISTIC and SEMVER-BASED: same inputs always produce the
 * same `CompatibilityResult`. The report is EXPLAINABLE: it breaks down
 * compatibility into `majorCompatible`, `minorCompatible`, and `rangeSatisfied`
 * so a human or tool can understand WHY a pair is compatible or not.
 *
 * Pure domain layer. No I/O, no Date.now(), no Math.random().
 */

import type { ArtifactKind } from "./version-artifact";

/**
 * The five compatibility dimensions the framework evaluates.
 */
export type CompatibilityDimension =
  | "protocol-kernel"
  | "package-application"
  | "application-domain"
  | "protocol-knowledge"
  | "protocol-compiler";

/**
 * A reference to an artifact at a specific version, used as a side of a
 * compatibility check.
 */
export interface CompatibilitySide {
  readonly kind: ArtifactKind;
  readonly id: string;
  readonly version: string;
}

/**
 * A single compatibility check to perform. The engine receives a list of these
 * and returns a parallel list of `CompatibilityResult`s.
 */
export interface CompatibilityCheck {
  /** Which compatibility dimension is being evaluated. */
  readonly dimension: CompatibilityDimension;
  /** The "from" side of the check (e.g. the protocol). */
  readonly source: CompatibilitySide;
  /** The "to" side of the check (e.g. the kernel). */
  readonly target: CompatibilitySide;
}

/**
 * An explainable compatibility report. The engine populates all three boolean
 * breakdowns so callers (UIs, tools, audits) can render a human-readable
 * rationale. The `details` string is a one-line summary suitable for logs.
 */
export interface CompatibilityReport {
  /** The dimension being evaluated. */
  readonly dimension: CompatibilityDimension;
  /** The source version string (echoed for context). */
  readonly sourceVersion: string;
  /** The target version string (echoed for context). */
  readonly targetVersion: string;
  /** True iff source and target share the same semver MAJOR. */
  readonly majorCompatible: boolean;
  /**
   * True iff the source's MINOR is <= the target's MINOR (when majors match).
   * This captures "the source does not require capabilities newer than the
   * target offers".
   */
  readonly minorCompatible: boolean;
  /**
   * True iff the target's version satisfies a declared supported range on the
   * source for the target's kind. When no range is declared, this is `true`
   * (the framework does not invent incompatibilities).
   */
  readonly rangeSatisfied: boolean;
  /** One-line human-readable summary. */
  readonly details: string;
}

/**
 * The outcome of a compatibility check.
 *
 * `compatible` is the headline boolean. `report` is the explainable breakdown.
 * `reason` is an optional short rationale when `compatible === false`.
 */
export interface CompatibilityResult {
  /** The original check (echoed for context). */
  readonly check: CompatibilityCheck;
  /** True iff source and target are compatible along this dimension. */
  readonly compatible: boolean;
  /** The explainable breakdown. */
  readonly report: CompatibilityReport;
  /** Optional short rationale when `compatible === false`. */
  readonly reason?: string;
}

/**
 * The CompatibilityEngine PORT. Pure, deterministic, semver-based.
 *
 * `check` accepts a list of checks and returns a parallel list of results —
 * the same length, in the same order. This bulk API keeps the engine stateless
 * and trivially parallelisable.
 */
export interface CompatibilityEngine {
  /**
   * Evaluate a list of compatibility checks. Returns one result per check, in
   * order. Pure and deterministic.
   */
  check(checks: readonly CompatibilityCheck[]): readonly CompatibilityResult[];
}
