/**
 * @kernel/api/v1 — COMPOSITION public surface (FROZEN).
 *
 * The Protocol Composition & Operational Package System: turns protocol source
 * into immutable, validated, deployable packages (.opspkg). Applications install
 * packages, not protocol source (ADR-0019).
 */

// Package model
export type {
  PackageManifest,
  PackageAuthor,
} from "@kernel/composition";
export { COMPOSITION_COMPILER_VERSION } from "@kernel/composition";

export type {
  PackageDependency,
  PackageCompatibility,
} from "@kernel/composition";
export { ANY_COMPATIBILITY } from "@kernel/composition";

export type {
  PackageContents,
  PackageDigest,
  PackageArtifact,
} from "@kernel/composition";
export { EMPTY_PACKAGE_CONTENTS } from "@kernel/composition";

export type {
  PackageSignature,
  Signer,
  Verifier,
  DigestProvider,
  SignatureStore,
} from "@kernel/composition";

export type {
  PackageDiagnostic,
  DiagnosticSeverity as PackageDiagnosticSeverity,
  CompositionStage,
  CompositionDiagnostics,
} from "@kernel/composition";

export type {
  OperationalPackage,
  PackageVersion,
} from "@kernel/composition";

// Pipeline
export type {
  CompositionInput,
  CompositionResult,
  CompositionStageResult,
  CompositionPipeline,
} from "@kernel/composition";
export { COMPOSITION_STAGES } from "@kernel/composition";

// Registry + lifecycle
export type { PackageRegistry } from "@kernel/composition";
export type {
  PackageLifecycleState,
  PackageLifecycleEvent,
} from "@kernel/composition";
export {
  LEGAL_TRANSITIONS as PACKAGE_LEGAL_TRANSITIONS,
  isLegalTransition as isLegalPackageTransition,
} from "@kernel/composition";

// Application
export type { InstallResult } from "@kernel/composition";
export { compileProtocol, CompileProtocolUseCase } from "@kernel/composition";
export { validatePackage, ValidatePackageUseCase } from "@kernel/composition";
export { installPackage } from "@kernel/composition";
export type { PackageInstaller } from "@kernel/composition";

// Infrastructure
export {
  InMemoryCompositionValidator,
  InMemoryCompositionLinker,
  InMemoryDependencyResolver,
  InMemoryPackagingEngine,
  DemoDigestProvider,
  DemoSigner,
  DemoVerifier,
  InMemoryPackageRegistry,
  InMemorySignatureStore,
  DefaultCompositionPipeline,
  DefaultPackageInstaller,
  createInMemoryComposition,
} from "@kernel/composition";
export type { InMemoryComposition } from "@kernel/composition";
