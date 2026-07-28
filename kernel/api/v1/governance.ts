/**
 * @kernel/api/v1 — GOVERNANCE public surface (FROZEN).
 *
 * The Platform Governance & Evolution Framework: governs how OpsOS evolves
 * while maintaining backward compatibility. Never changes operational behavior.
 * Defines how the platform evolves (ADR-0022).
 */

// Version artifacts
export type {
  ArtifactKind,
  VersionArtifact,
  SupportedRange,
} from "@kernel/governance";

// Feature lifecycle
export type {
  FeatureLifecycleState,
  FeatureLifecycleDeclaration,
} from "@kernel/governance";
export {
  LEGAL_LIFECYCLE_TRANSITIONS,
  canTransitionLifecycle,
} from "@kernel/governance";

// Certification
export type {
  CertificationKind,
  CertificationStatus as GovernanceCertificationStatus,
  Certification as GovernanceCertification,
  CertificationEngine,
} from "@kernel/governance";

// Compatibility
export type {
  CompatibilityDimension,
  CompatibilitySide,
  CompatibilityCheck,
  CompatibilityReport,
  CompatibilityResult,
  CompatibilityEngine,
} from "@kernel/governance";

// Migration
export type {
  MigrationType,
  MigrationStep,
  MigrationPlan,
  MigrationResult,
  MigrationEngine,
} from "@kernel/governance";

// Governance policies
export type {
  GovernancePolicyKind,
  EnforcementLevel,
  GovernancePolicy,
} from "@kernel/governance";

// Evolution history
export type {
  MigrationRecord,
  CompatibilityRecord,
  EvolutionHistoryEntry,
  EvolutionHistory,
} from "@kernel/governance";

// Registry
export type { GovernanceRegistry } from "@kernel/governance";

// Application
export { checkCompatibility as checkGovernanceCompatibility } from "@kernel/governance";
export { planMigration, dryRunMigration, executeMigration } from "@kernel/governance";
export { certifyArtifact } from "@kernel/governance";
export { getEvolutionHistory as getGovernanceEvolutionHistory } from "@kernel/governance";

// Infrastructure
export {
  InMemoryGovernanceRegistry,
  DefaultCompatibilityEngine,
  DefaultMigrationEngine,
  DefaultCertificationEngine,
  createGovernanceFramework,
} from "@kernel/governance";
export type { GovernanceFramework } from "@kernel/governance";

// Semver utilities (governance-local mirror)
export {
  parseSemver as governanceParseSemver,
  isValidSemver as governanceIsValidSemver,
  compareSemver as governanceCompareSemver,
  compareSemverStrings as governanceCompareSemverStrings,
  satisfiesRange as governanceSatisfiesRange,
} from "@kernel/governance";
export type { ParsedSemver as GovernanceParsedSemver } from "@kernel/governance";
