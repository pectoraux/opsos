/**
 * @kernel/governance — root entry. Re-exports the public interfaces barrel.
 *
 * The Platform Governance & Evolution Framework (Milestone 13). Governs how
 * the OpsOS platform evolves while maintaining backward compatibility for
 * installed domains, protocols, packages, and applications.
 *
 * Public surface (see `interfaces/index.ts`):
 *   - Domain:      VersionArtifact, ArtifactKind, FeatureLifecycleState,
 *                  FeatureLifecycleDeclaration, LEGAL_LIFECYCLE_TRANSITIONS,
 *                  canTransitionLifecycle, CompatibilityCheck, CompatibilityResult,
 *                  CompatibilityReport, CompatibilityDimension, CompatibilityEngine,
 *                  MigrationType, MigrationStep, MigrationPlan, MigrationResult,
 *                  MigrationEngine, GovernancePolicy, GovernancePolicyKind,
 *                  EnforcementLevel, Certification, CertificationKind,
 *                  CertificationStatus, CertificationEngine, EvolutionHistory,
 *                  EvolutionHistoryEntry, MigrationRecord, CompatibilityRecord,
 *                  GovernanceRegistry.
 *   - Application: checkCompatibility (+CheckCompatibility), planMigration /
 *                  dryRunMigration / executeMigration (+PlanMigration),
 *                  certifyArtifact (+CertifyArtifact), getEvolutionHistory
 *                  (+GetEvolutionHistory).
 *   - Infrastructure: InMemoryGovernanceRegistry, DefaultCompatibilityEngine,
 *                  DefaultMigrationEngine, DefaultCertificationEngine,
 *                  createGovernanceFramework (+GovernanceFramework +
 *                  GovernanceZeroClock + CreateGovernanceFrameworkOptions),
 *                  semver utilities (parseSemver, isValidSemver, compareSemver,
 *                  compareSemverStrings, satisfiesRange, ParsedSemver).
 */
export * from "./interfaces";
