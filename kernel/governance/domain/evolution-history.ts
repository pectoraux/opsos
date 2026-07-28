/**
 * @kernel/governance/domain/evolution-history — the version lineage of an
 * artifact.
 *
 * `EvolutionHistory` is the full, append-only record of every version of an
 * artifact that has ever been registered, together with its migration
 * history, certification history, and compatibility history. It is the
 * "git log" of a single artifact — the authoritative answer to "what has
 * happened to this thing over its lifetime?".
 *
 * The history is RECONSTRUCTED from the registry's state — it is NOT a
 * separate write-ahead log. When the registry returns an `EvolutionHistory`,
 * it walks the version chain (`predecessor`/`successor`) and aggregates the
 * per-version certifications and any recorded migration / compatibility
 * events.
 *
 * Pure domain layer. No I/O, no Date.now(), no Math.random().
 */

import type { ArtifactKind } from "./version-artifact";
import type { Certification } from "./certification";

/**
 * A compact record of a single migration that has been performed involving
 * this version (either as source or target). `type` is one of the
 * `MigrationType` values (`upgrade` | `downgrade` | `rollback` |
 * `staged-rollout` | `canary`).
 */
export interface MigrationRecord {
  /** The version migrated from. */
  readonly from: string;
  /** The version migrated to. */
  readonly to: string;
  /** Epoch-millis when the migration was recorded (caller-supplied — never Date.now()). */
  readonly at: number;
  /** The migration type (one of the `MigrationType` values). */
  readonly type: string;
}

/**
 * A compact record of a single compatibility check involving this version.
 */
export interface CompatibilityRecord {
  /** The version this entry's version was checked against. */
  readonly target: string;
  /** Whether the check found the pair compatible. */
  readonly compatible: boolean;
  /** Epoch-millis when the check was recorded (caller-supplied — never Date.now()). */
  readonly at: number;
}

/**
 * A single entry in an artifact's evolution history — one per registered
 * version.
 */
export interface EvolutionHistoryEntry {
  /** The version this entry describes. */
  readonly version: string;
  /** The predecessor version, if any. */
  readonly predecessor?: string;
  /** The successor version, if any. */
  readonly successor?: string;
  /** Migrations recorded involving this version. */
  readonly migrationHistory: readonly MigrationRecord[];
  /** Certifications carried by or recorded against this version. */
  readonly certificationHistory: readonly Certification[];
  /** Compatibility checks recorded involving this version. */
  readonly compatibilityHistory: readonly CompatibilityRecord[];
  /** Epoch-millis when this version was released (caller-supplied — never Date.now()). */
  readonly releasedAt: number;
}

/**
 * The full evolution history for a single artifact.
 *
 * `entries` is sorted in version-ascending order (by semver compare) so the
 * history reads naturally from oldest to newest.
 */
export interface EvolutionHistory {
  /** The artifact's stable id. */
  readonly artifactId: string;
  /** The artifact's kind. */
  readonly kind: ArtifactKind;
  /** One entry per registered version, in version-ascending order. */
  readonly entries: readonly EvolutionHistoryEntry[];
}
