/**
 * @kernel/governance/domain/governance-registry — the registry PORT.
 *
 * The `GovernanceRegistry` is the authoritative store of everything the
 * governance framework knows:
 *
 *   - registered `VersionArtifact`s (the version catalogue)
 *   - registered `GovernancePolicy`s (the policy catalogue)
 *   - registered `FeatureLifecycleDeclaration`s (the lifecycle log)
 *
 * The registry reconstructs `EvolutionHistory` on demand from the version
 * catalogue (plus any migration / compatibility records the in-memory
 * implementation tracks internally).
 *
 * This is a PORT (interface only) — the deterministic core never depends on a
 * concrete implementation. The default in-memory implementation lives in
 * `infrastructure/in-memory-governance-registry.ts`.
 *
 * Pure domain layer. No I/O, no Date.now(), no Math.random().
 */

import type { VersionArtifact } from "./version-artifact";
import type { EvolutionHistory } from "./evolution-history";
import type { GovernancePolicy } from "./governance-policy";
import type { FeatureLifecycleDeclaration } from "./feature-lifecycle";

/**
 * The GovernanceRegistry PORT.
 *
 * All methods are synchronous and deterministic. `registerVersion` is
 * idempotent — re-registering the same `(id, version)` pair replaces the
 * prior artifact in-place (useful for adding a `certification` to a
 * previously-uncertified version).
 */
export interface GovernanceRegistry {
  /**
   * Register a version artifact. Idempotent per `(id, version)` — re-registering
   * replaces the prior artifact. Does NOT mutate the predecessor/successor
   * chain of OTHER versions (callers manage linking explicitly).
   */
  registerVersion(artifact: VersionArtifact): void;

  /** Look up a specific version of an artifact. */
  getVersion(id: string, version: string): VersionArtifact | undefined;

  /** List all registered versions of an artifact, in version-ascending order. */
  listVersions(id: string): readonly VersionArtifact[];

  /** The latest registered version of an artifact (highest semver). */
  getLatest(id: string): VersionArtifact | undefined;

  /** Reconstruct the full evolution history for an artifact. */
  getEvolutionHistory(id: string): EvolutionHistory | undefined;

  /** Register a governance policy. Idempotent per `policy.id` (replace-in-place). */
  registerPolicy(policy: GovernancePolicy): void;

  /** List all registered policies, in registration order. */
  listPolicies(): readonly GovernancePolicy[];

  /** Append a lifecycle declaration. Declarations are append-only. */
  registerLifecycleDeclaration(decl: FeatureLifecycleDeclaration): void;

  /** All lifecycle declarations for a specific `(id, version)` pair, in declaration order. */
  getLifecycle(id: string, version: string): readonly FeatureLifecycleDeclaration[];
}
