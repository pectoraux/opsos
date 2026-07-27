/**
 * @kernel/composition/domain/operational-package — `OperationalPackage`,
 * `PackageVersion`, `PackageLifecycleState`.
 *
 * `OperationalPackage` is THE public alias for the immutable artifact the
 * composition pipeline produces. It is identical to `PackageArtifact` — the
 * alias exists so the installer / registry APIs read with intent ("an
 * operational package", not "a generic artifact").
 *
 * Pure domain layer.
 */

import type { PackageArtifact } from "./package-artifact";
import type { PackageLifecycleState } from "./package-lifecycle";

/** THE immutable operational package artifact (alias for `PackageArtifact`). */
export type OperationalPackage = PackageArtifact;

/**
 * A `(packageId, version)` pair — the canonical lookup key for a registered
 * `OperationalPackage`.
 */
export interface PackageVersion {
  readonly id: string;
  readonly version: string;
}

/** Re-export for convenience so callers can reach the lifecycle type from here. */
export type { PackageLifecycleState };
