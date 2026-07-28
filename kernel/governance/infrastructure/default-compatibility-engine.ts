/**
 * @kernel/governance/infrastructure/default-compatibility-engine — the default
 * `CompatibilityEngine` implementation.
 *
 * Deterministic, semver-based compatibility checking. The headline rule (per
 * the spec): "major mismatch = incompatible, minor = compatible, patch =
 * compatible". When the source declares a supported range for the target's
 * kind, that range is also consulted (and must be satisfied) — this lets a
 * protocol declare `"kernel": "^1.2.0"` and have the engine reject `1.1.0`
 * even though the majors match.
 *
 * The engine optionally takes a `GovernanceRegistry` to look up the source
 * artifact's declared `supportedRanges`. If no registry is supplied, or the
 * source is not registered, or no range is declared for the target's kind,
 * `rangeSatisfied` defaults to `true` (the framework does not invent
 * incompatibilities).
 *
 * Reports are EXPLAINABLE: every result carries a `CompatibilityReport` with
 * `majorCompatible`, `minorCompatible`, `rangeSatisfied`, and a one-line
 * `details` string.
 *
 * Pure and deterministic: same inputs always produce the same outputs.
 */

import type {
  CompatibilityCheck,
  CompatibilityReport,
  CompatibilityResult,
  CompatibilityEngine,
} from "../domain/compatibility";
import type { GovernanceRegistry } from "../domain/governance-registry";
import { compareSemver, parseSemver, satisfiesRange } from "./semver";

/** Options for constructing a `DefaultCompatibilityEngine`. */
export interface DefaultCompatibilityEngineOptions {
  /**
   * Optional registry for looking up declared `supportedRanges` on source
   * artifacts. If absent, `rangeSatisfied` is always `true`.
   */
  readonly registry?: GovernanceRegistry;
}

/**
 * The default in-memory `CompatibilityEngine`. Stateless aside from its
 * optional registry reference.
 */
export class DefaultCompatibilityEngine implements CompatibilityEngine {
  private readonly registry?: GovernanceRegistry;

  constructor(options: DefaultCompatibilityEngineOptions = {}) {
    this.registry = options.registry;
  }

  /** @inheritdoc */
  check(checks: readonly CompatibilityCheck[]): readonly CompatibilityResult[] {
    return checks.map((c) => this.checkOne(c));
  }

  /** Evaluate a single check. Pure. */
  private checkOne(check: CompatibilityCheck): CompatibilityResult {
    const sourceVersion = check.source.version;
    const targetVersion = check.target.version;
    const sourceParsed = parseSemver(sourceVersion);
    const targetParsed = parseSemver(targetVersion);

    if (!sourceParsed || !targetParsed) {
      // Unparseable version — return an incompatible result with an explainable report.
      const report: CompatibilityReport = {
        dimension: check.dimension,
        sourceVersion,
        targetVersion,
        majorCompatible: false,
        minorCompatible: false,
        rangeSatisfied: false,
        details: `Unparseable version (source=${sourceVersion}, target=${targetVersion})`,
      };
      return {
        check,
        compatible: false,
        report,
        reason: `One or both versions are not valid semver`,
      };
    }

    const majorCompatible = sourceParsed.major === targetParsed.major;
    const minorCompatible =
      majorCompatible && sourceParsed.minor <= targetParsed.minor;

    // Range satisfaction: look up the source's declared supportedRanges for the
    // target's kind. If a range is declared, it must be satisfied. If no range
    // is declared (or no registry, or source not registered), rangeSatisfied is
    // `true` (the framework does not invent incompatibilities).
    let rangeSatisfied = true;
    let declaredRange: string | undefined;
    if (this.registry) {
      const sourceArtifact = this.registry.getVersion(
        check.source.id,
        sourceVersion
      );
      if (sourceArtifact?.supportedRanges) {
        const match = sourceArtifact.supportedRanges.find(
          (r) => r.kind === check.target.kind
        );
        if (match) {
          declaredRange = match.range;
          rangeSatisfied = satisfiesRange(targetVersion, match.range);
        }
      }
    }

    // Headline: majors must match AND any declared range must be satisfied.
    const compatible = majorCompatible && rangeSatisfied;

    const details = this.buildDetails(
      check.dimension,
      sourceVersion,
      targetVersion,
      majorCompatible,
      minorCompatible,
      rangeSatisfied,
      declaredRange
    );

    const report: CompatibilityReport = {
      dimension: check.dimension,
      sourceVersion,
      targetVersion,
      majorCompatible,
      minorCompatible,
      rangeSatisfied,
      details,
    };

    let reason: string | undefined;
    if (!compatible) {
      const parts: string[] = [];
      if (!majorCompatible) {
        parts.push(
          `major mismatch (source ${sourceParsed.major} vs target ${targetParsed.major})`
        );
      }
      if (!rangeSatisfied && declaredRange) {
        parts.push(
          `target ${targetVersion} does not satisfy declared range '${declaredRange}'`
        );
      }
      reason = parts.join("; ");
    }

    return { check, compatible, report, reason };
  }

  /** Build the one-line human-readable `details` string. Pure. */
  private buildDetails(
    dimension: CompatibilityCheck["dimension"],
    sourceVersion: string,
    targetVersion: string,
    majorCompatible: boolean,
    minorCompatible: boolean,
    rangeSatisfied: boolean,
    declaredRange: string | undefined
  ): string {
    const parts: string[] = [];
    parts.push(`[${dimension}] ${sourceVersion} ↔ ${targetVersion}`);
    parts.push(`major=${majorCompatible ? "ok" : "mismatch"}`);
    parts.push(`minor=${minorCompatible ? "ok" : "mismatch"}`);
    if (declaredRange) {
      parts.push(
        `range '${declaredRange}'=${rangeSatisfied ? "satisfied" : "not-satisfied"}`
      );
    } else {
      parts.push("range=none-declared");
    }
    return parts.join(" ");
  }

  /**
   * Compare two semver strings; helper exposed for callers that want the same
   * comparator the engine uses internally.
   */
  static compare(a: string, b: string): number {
    const pa = parseSemver(a);
    const pb = parseSemver(b);
    if (!pa || !pb) return 0;
    return compareSemver(pa, pb);
  }
}
