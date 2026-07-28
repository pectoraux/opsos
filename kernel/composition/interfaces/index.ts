/**
 * @kernel/composition — public surface.
 *
 * The Composition & Operational Package System — the build system that turns
 * protocol source definitions into immutable, validated, deployable packages
 * (`.opspkg`). This is the last piece of kernel infrastructure.
 *
 * The layering is: `Knowledge → Domain Definition → Protocol → Composition →
 * Operational Package (.opspkg) → Application Installation`. Applications
 * install PACKAGES, not protocol source — like Docker images / Helm charts /
 * VS Code extensions, not npm libraries.
 *
 * Public surface:
 *   - Domain types:    PackageManifest, PackageAuthor, PackageDependency,
 *                      PackageCompatibility, PackageContents,
 *                      EMPTY_PACKAGE_CONTENTS, PackageDigest, PackageArtifact,
 *                      PackageSignature, OperationalPackage, PackageVersion,
 *                      PackageLifecycleState, PackageLifecycleEvent,
 *                      LEGAL_TRANSITIONS, isLegalTransition,
 *                      illegalTransitionDiagnostic, lifecycleEvent,
 *                      PackageDiagnostic, DiagnosticSeverity,
 *                      CompositionStage, CompositionDiagnostics,
 *                      compositionDiagnostics, diagnostic, hasErrors,
 *                      errorsOnly, COMPOSITION_STAGES, CompositionInput,
 *                      CompositionResult, CompositionStageResult,
 *                      CompositionPipeline (PORT), PackageRegistry (PORT),
 *                      Signer (PORT), Verifier (PORT), DigestProvider (PORT),
 *                      SignatureStore (PORT), COMPOSITION_COMPILER_VERSION,
 *                      ANY_COMPATIBILITY.
 *   - Application:     compileProtocol (+ CompileProtocolInput/Deps/Result,
 *                      CompileProtocolUseCase, compileProtocolAsync),
 *                      validatePackage (+ ValidatePackageDeps/Result,
 *                      ValidatePackageUseCase), InstallResult, PackageInstaller
 *                      (PORT), installPackage (+ InstallPackageDeps,
 *                      InstallPackageUseCase).
 *   - Infrastructure:  InMemoryCompositionValidator, InMemoryCompositionLinker,
 *                      InMemoryDependencyResolver (+ satisfiesRange,
 *                      compareSemverStrings), InMemoryPackagingEngine,
 *                      DemoDigestProvider, DemoSigner, DemoVerifier,
 *                      canonicalStringify, DEMO_DIGEST_ALGORITHM,
 *                      DEMO_SIGNATURE_ALGORITHM, InMemoryPackageRegistry,
 *                      InMemorySignatureStore, DefaultCompositionPipeline,
 *                      DefaultPackageInstaller, InMemoryComposition (bundle),
 *                      createInMemoryComposition() helper.
 *
 * Determinism guarantees (enforced):
 *   - NO `Date.now()` / `Math.random()` anywhere in this module.
 *   - All time flows through the `now` argument (CompositionInput.now) or
 *     `manifest.buildTimestamp` (for installer operations on already-built
 *     packages).
 *   - Digest is a deterministic hash of the canonical-JSON serialised
 *     contents (djb2-style; NOT cryptographically strong — demo only).
 *   - Pipeline stage ordering is fixed (`COMPOSITION_STAGES`).
 *   - Dependency resolution uses topological sort with lexicographic-id
 *     tie-break.
 *
 * Layered dependency direction:
 *   `interfaces/ → application/ → domain/`
 *   `infrastructure/ → application/ → domain/`
 *   `domain/` depends ONLY on `@kernel/shared-kernel` (values + types),
 *   `@kernel/protocol-sdk` (type-only ProtocolManifest), and
 *   `@kernel/domain-modeling` (type-only DomainDefinition).
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
