/**
 * @kernel/application-runtime/versioning — version manager.
 *
 * Applications pin protocol versions. Support upgrades, rollback, and
 * compatibility checks (the pinned protocol version must satisfy the
 * application's declared range, if any).
 */

import type { SemverString } from "@kernel/protocol-sdk";
import { satisfiesRange, isValidSemver, compareSemver, parseSemver } from "@kernel/protocol-sdk";

export interface VersionCompatibilityResult {
  readonly compatible: boolean;
  readonly reason?: string;
}

/** Check that `pinnedVersion` is compatible with `installedVersion`. */
export function checkCompatibility(
  pinnedVersion: SemverString,
  installedVersion: SemverString
): VersionCompatibilityResult {
  if (!isValidSemver(pinnedVersion)) {
    return { compatible: false, reason: `'${pinnedVersion}' is not a valid semver` };
  }
  if (!isValidSemver(installedVersion)) {
    return { compatible: false, reason: `'${installedVersion}' is not a valid semver` };
  }
  const pinned = parseSemver(pinnedVersion)!;
  const installed = parseSemver(installedVersion)!;
  if (pinned.major !== installed.major) {
    return {
      compatible: false,
      reason: `Major version mismatch: application pins ${pinnedVersion}, protocol is ${installedVersion}`,
    };
  }
  return { compatible: true };
}

/** Compare two application versions (for upgrade ordering). */
export function compareApplicationVersions(a: SemverString, b: SemverString): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  return compareSemver(pa, pb);
}

/**
 * Determine if an upgrade from `fromVersion` to `toVersion` is a valid
 * forward upgrade (not a downgrade).
 */
export function isUpgrade(fromVersion: SemverString, toVersion: SemverString): boolean {
  return compareApplicationVersions(fromVersion, toVersion) < 0;
}
