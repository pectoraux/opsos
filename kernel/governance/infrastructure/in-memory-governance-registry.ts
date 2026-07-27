/**
 * @kernel/governance/infrastructure/in-memory-governance-registry — the default
 * in-memory `GovernanceRegistry` implementation.
 *
 * Stores version artifacts, policies, lifecycle declarations, and (optionally)
 * recorded migration and compatibility events in plain `Map`s. Reconstructs
 * `EvolutionHistory` on demand by walking the version catalogue and
 * aggregating per-version events.
 *
 * The implementation EXPOSES two extension methods beyond the public port —
 * `recordMigration` and `recordCompatibility` — which the application use-cases
 * (`plan-migration`, `check-compatibility`) call to feed runtime events into
 * the registry. These extensions live on the in-memory class only (NOT on the
 * `GovernanceRegistry` port) so the port stays minimal and other
 * implementations are free to track (or not track) runtime events however they
 * please.
 *
 * Deterministic: no `Date.now()`, no `Math.random()`. All time is supplied by
 * the caller. All listings are sorted deterministically (semver-ascending for
 * versions, declaration-order for lifecycle, registration-order for policies).
 */

import type { VersionArtifact } from "../domain/version-artifact";
import type { EvolutionHistory, EvolutionHistoryEntry } from "../domain/evolution-history";
import type { GovernancePolicy } from "../domain/governance-policy";
import type { FeatureLifecycleDeclaration } from "../domain/feature-lifecycle";
import type { GovernanceRegistry } from "../domain/governance-registry";
import { compareSemverStrings, parseSemver } from "./semver";

/**
 * An internal migration record, attributed to a specific artifact id.
 * `from`/`to` are version strings; the entry is attached to BOTH versions'
 * history entries when reconstructing evolution history.
 */
interface InternalMigrationRecord {
  readonly artifactId: string;
  readonly from: string;
  readonly to: string;
  readonly at: number;
  readonly type: string;
}

/**
 * An internal compatibility record, attributed to a specific artifact id and
 * source version. `target` is the version the source was checked against.
 */
interface InternalCompatibilityRecord {
  readonly artifactId: string;
  readonly sourceVersion: string;
  readonly target: string;
  readonly compatible: boolean;
  readonly at: number;
}

/**
 * The default in-memory `GovernanceRegistry`. Construction is cheap; instances
 * are NOT thread-safe (the kernel is single-threaded deterministic).
 */
export class InMemoryGovernanceRegistry implements GovernanceRegistry {
  /** artifactId → (version → VersionArtifact). */
  private readonly versions = new Map<string, Map<string, VersionArtifact>>();
  /** policyId → GovernancePolicy. Preserves registration order. */
  private readonly policies = new Map<string, GovernancePolicy>();
  /** artifactId → (version → declarations[]). */
  private readonly declarations = new Map<
    string,
    Map<string, FeatureLifecycleDeclaration[]>
  >();
  /** All migration records, in insertion order. */
  private readonly migrationRecords: InternalMigrationRecord[] = [];
  /** All compatibility records, in insertion order. */
  private readonly compatibilityRecords: InternalCompatibilityRecord[] = [];

  // ── GovernanceRegistry port ───────────────────────────────────────────────

  /** @inheritdoc */
  registerVersion(artifact: VersionArtifact): void {
    let byVersion = this.versions.get(artifact.id);
    if (!byVersion) {
      byVersion = new Map<string, VersionArtifact>();
      this.versions.set(artifact.id, byVersion);
    }
    byVersion.set(artifact.version, artifact);
  }

  /** @inheritdoc */
  getVersion(id: string, version: string): VersionArtifact | undefined {
    return this.versions.get(id)?.get(version);
  }

  /** @inheritdoc */
  listVersions(id: string): readonly VersionArtifact[] {
    const byVersion = this.versions.get(id);
    if (!byVersion) return [];
    return Array.from(byVersion.values()).sort((a, b) =>
      compareSemverStrings(a.version, b.version)
    );
  }

  /** @inheritdoc */
  getLatest(id: string): VersionArtifact | undefined {
    const versions = this.listVersions(id);
    return versions.length > 0 ? versions[versions.length - 1] : undefined;
  }

  /** @inheritdoc */
  getEvolutionHistory(id: string): EvolutionHistory | undefined {
    const byVersion = this.versions.get(id);
    if (!byVersion || byVersion.size === 0) return undefined;
    const kind = byVersion.values().next().value!.kind;
    const entries: EvolutionHistoryEntry[] = Array.from(byVersion.values())
      .sort((a, b) => compareSemverStrings(a.version, b.version))
      .map((artifact) => {
        const migrationHistory = this.migrationRecords
          .filter(
            (r) =>
              r.artifactId === id &&
              (r.from === artifact.version || r.to === artifact.version)
          )
          .map((r) => ({
            from: r.from,
            to: r.to,
            at: r.at,
            type: r.type,
          }));
        const compatibilityHistory = this.compatibilityRecords
          .filter(
            (r) =>
              r.artifactId === id && r.sourceVersion === artifact.version
          )
          .map((r) => ({
            target: r.target,
            compatible: r.compatible,
            at: r.at,
          }));
        const certificationHistory = artifact.certification
          ? [artifact.certification]
          : [];
        return {
          version: artifact.version,
          predecessor: artifact.predecessor,
          successor: artifact.successor,
          migrationHistory,
          certificationHistory,
          compatibilityHistory,
          releasedAt: artifact.releasedAt,
        };
      });
    return {
      artifactId: id,
      kind,
      entries,
    };
  }

  /** @inheritdoc */
  registerPolicy(policy: GovernancePolicy): void {
    this.policies.set(policy.id, policy);
  }

  /** @inheritdoc */
  listPolicies(): readonly GovernancePolicy[] {
    return Array.from(this.policies.values());
  }

  /** @inheritdoc */
  registerLifecycleDeclaration(decl: FeatureLifecycleDeclaration): void {
    let byVersion = this.declarations.get(decl.artifactId);
    if (!byVersion) {
      byVersion = new Map<string, FeatureLifecycleDeclaration[]>();
      this.declarations.set(decl.artifactId, byVersion);
    }
    let list = byVersion.get(decl.version);
    if (!list) {
      list = [];
      byVersion.set(decl.version, list);
    }
    list.push(decl);
  }

  /** @inheritdoc */
  getLifecycle(id: string, version: string): readonly FeatureLifecycleDeclaration[] {
    return this.declarations.get(id)?.get(version) ?? [];
  }

  // ── In-memory extensions (used by application use-cases) ──────────────────

  /**
   * Record that a migration was performed on `artifactId` from `from` to `to`
   * at epoch-millis `at` of the given `type`. The record is attributed to
   * `artifactId` and will appear in the migrationHistory of BOTH the `from`
   * and `to` version entries when evolution history is reconstructed.
   *
   * NOT part of the public `GovernanceRegistry` port — exposed as an
   * in-memory extension. Other implementations are free to ignore runtime
   * events entirely.
   */
  recordMigration(
    artifactId: string,
    from: string,
    to: string,
    at: number,
    type: string
  ): void {
    this.migrationRecords.push({ artifactId, from, to, at, type });
  }

  /**
   * Record that a compatibility check was performed against `sourceVersion`
   * of `artifactId`, comparing it with `target` (a version string of another
   * artifact), yielding `compatible` at epoch-millis `at`.
   *
   * NOT part of the public `GovernanceRegistry` port — exposed as an
   * in-memory extension.
   */
  recordCompatibility(
    artifactId: string,
    sourceVersion: string,
    target: string,
    compatible: boolean,
    at: number
  ): void {
    this.compatibilityRecords.push({
      artifactId,
      sourceVersion,
      target,
      compatible,
      at,
    });
  }

  // ── Introspection (for tests / demos — NOT part of the port) ──────────────

  /** The number of registered artifacts (distinct ids). */
  artifactCount(): number {
    return this.versions.size;
  }

  /** The total number of registered version artifacts across all ids. */
  versionCount(): number {
    let n = 0;
    for (const byVersion of this.versions.values()) n += byVersion.size;
    return n;
  }

  /** True iff `version` is a syntactically valid semver (helper for callers). */
  static isValidVersion(version: string): boolean {
    return parseSemver(version) !== null;
  }
}
