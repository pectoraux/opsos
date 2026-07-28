/**
 * @kernel/governance/domain/version-artifact — the immutable versioned artifact.
 *
 * Every versionable thing on OpsOS (the kernel itself, the public API, a
 * domain, a knowledge pack, a protocol, a package, an application) is described
 * by a `VersionArtifact`. A version artifact is an IMMUTABLE record — once
 * registered it never changes. Evolving an artifact produces a NEW artifact
 * with a NEW version, linked to its predecessor/successor.
 *
 * Governance NEVER changes operational behaviour. Governance only describes HOW
 * the platform evolves: which versions exist, what lifecycle state they are in,
 * whether they are certified, and what version ranges they are compatible with.
 *
 * The seven `ArtifactKind`s partition the platform's versionable surface:
 *   - `kernel`:       the OpsOS kernel (the deterministic core).
 *   - `api`:          the public API surface (currently v1, future v2…).
 *   - `domain`:       a domain model (Cleaning, Mobility, …).
 *   - `knowledge`:    a knowledge pack (facts, procedures, standards, …).
 *   - `protocol`:     a protocol (operational package + manifest).
 *   - `package`:      a composed package (protocol + dependencies + signature).
 *   - `application`:  an installed application instance.
 *
 * Pure domain layer. No I/O, no Date.now(), no Math.random().
 */

import type { FeatureLifecycleState } from "./feature-lifecycle";
import type { Certification } from "./certification";

/**
 * The seven kinds of versionable artifacts governed by the framework.
 */
export type ArtifactKind =
  | "kernel"
  | "api"
  | "domain"
  | "knowledge"
  | "protocol"
  | "package"
  | "application";

/**
 * A supported compatibility range. An artifact declares "I am compatible with
 * artifacts of `kind` whose version satisfies `range`" (a semver range string,
 * e.g. `"^1.2.0"`, `">=2.0.0 <3.0.0"`). The compatibility engine consults
 * these when checking `source ↔ target` pairs.
 */
export interface SupportedRange {
  readonly kind: ArtifactKind;
  readonly range: string;
}

/**
 * The immutable versioned artifact.
 *
 * `id` is the artifact's stable identifier across versions (e.g. `"kernel"`,
 * `"domain/cleaning"`); `version` is the semver of this specific release. The
 * `(id, version)` pair is the global primary key.
 *
 * `predecessor` / `successor` form a doubly-linked version lineage. They are
 * optional because the very first release has no predecessor and the latest
 * release has no successor yet.
 *
 * `supportedRanges` declares what this artifact is compatible with (e.g. a
 * protocol declaring `"kernel": "^1.2.0"`). The compatibility engine uses
 * these to produce explainable CompatibilityReports.
 *
 * `certification` is the optional certification carried by this version
 * (e.g. `protocol-certified`, `kernel-compatible`). The certification engine
 * issues certifications; the registry snapshots them onto the artifact at
 * registration time.
 *
 * `releasedAt` is the epoch-millis release timestamp, supplied by the caller —
 * never sourced from `Date.now()` inside the deterministic core.
 *
 * `metadata` is an opaque, serialisable record for caller-defined provenance
 * (commit sha, build id, release channel, …). The framework does not interpret it.
 */
export interface VersionArtifact {
  /** Stable identifier across versions (e.g. `"kernel"`, `"domain/cleaning"`). */
  readonly id: string;
  /** Which of the seven kinds this artifact is. */
  readonly kind: ArtifactKind;
  /** The semver string for this release (e.g. `"1.2.0"`). */
  readonly version: string;
  /** The previous version of this artifact, if any. */
  readonly predecessor?: string;
  /** The next version of this artifact, if any. */
  readonly successor?: string;
  /** The lifecycle state of this version. */
  readonly lifecycle: FeatureLifecycleState;
  /** Compatibility ranges this artifact declares (semver range strings). */
  readonly supportedRanges?: readonly SupportedRange[];
  /** The certification carried by this version, if any. */
  readonly certification?: Certification;
  /** Epoch-millis release timestamp (caller-supplied — never Date.now()). */
  readonly releasedAt: number;
  /** Opaque, serialisable, caller-defined provenance. */
  readonly metadata: Readonly<Record<string, unknown>>;
}
