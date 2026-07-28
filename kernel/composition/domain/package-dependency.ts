/**
 * @kernel/composition/domain/package-dependency — `PackageDependency` and
 * `PackageCompatibility`.
 *
 * A package declares dependencies on OTHER packages by id + semver range, and
 * declares compatibility constraints against the kernel's own version surface
 * (apiVersion, kernelVersion, protocolVersion). The composition dependency
 * resolver checks both — declared dependencies must be present and version-
 * compatible, and the package's compatibility envelope must be satisfiable by
 * the host kernel.
 *
 * Pure domain layer.
 */

/**
 * A dependency on another package.
 *
 *   `id`            — the package id (e.g. `"opsos.protocol.shared-resources"`).
 *   `versionRange`  — a semver range (e.g. `"^1.2.0"`).
 *   `optional`      — when true, the dependency MAY be absent (a missing
 *                     optional dep is not an error). Defaults to `false`.
 */
export interface PackageDependency {
  readonly id: string;
  readonly versionRange: string;
  readonly optional?: boolean;
}

/**
 * Compatibility constraints a package declares against the host kernel.
 *
 * Every package targets a specific kernel API version (the surface it depends
 * on). It may also declare:
 *   - `kernelVersion`   — minimum kernel implementation version required
 *                          (informational; checked by the installer).
 *   - `apiVersion`      — exact OR range of API versions the package supports.
 *   - `protocolVersion` — protocol-source version the package was built from.
 *
 * All fields are semver ranges (strings). `*` means "any".
 */
export interface PackageCompatibility {
  readonly kernelVersion?: string;
  readonly apiVersion?: string;
  readonly protocolVersion?: string;
}

/** Wildcard compatibility — accepts anything. Useful as a default. */
export const ANY_COMPATIBILITY: PackageCompatibility = {
  kernelVersion: "*",
  apiVersion: "*",
  protocolVersion: "*",
};
