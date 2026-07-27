/**
 * @kernel/composition/infrastructure — barrel + `InMemoryComposition`
 * bundle + `createInMemoryComposition()` helper.
 *
 * The infrastructure layer of the Composition & Operational Package System.
 * Concrete in-memory implementations of every port. Pure data structures;
 * no `Date.now()`, no `Math.random()`. Suitable for tests, deterministic
 * replay, and as reference implementations for protocol authors.
 *
 * Public surface:
 *   - InMemoryCompositionValidator
 *   - InMemoryCompositionLinker
 *   - InMemoryDependencyResolver (+ satisfiesRange, compareSemverStrings)
 *   - InMemoryPackagingEngine
 *   - DemoDigestProvider, DemoSigner, DemoVerifier (+ canonicalStringify)
 *   - InMemoryPackageRegistry
 *   - InMemorySignatureStore
 *   - DefaultCompositionPipeline (+ DefaultCompositionPipelineDeps)
 *   - DefaultPackageInstaller (+ DefaultPackageInstallerDeps)
 *   - InMemoryComposition (bundle interface)
 *   - createInMemoryComposition() (bundle helper)
 */

export { InMemoryCompositionValidator } from "./composition-validator";
export type { ValidatorContext } from "./composition-validator";
export { InMemoryCompositionLinker } from "./composition-linker";
export type { LinkerResult } from "./composition-linker";
export {
  InMemoryDependencyResolver,
  satisfiesRange,
  compareSemverStrings,
} from "./dependency-resolver";
export type { DependencyResolution } from "./dependency-resolver";
export { InMemoryPackagingEngine } from "./packaging-engine";
export type { BundleInput, BundleResult } from "./packaging-engine";
export {
  DemoDigestProvider,
  DemoSigner,
  DemoVerifier,
  canonicalStringify,
  DEMO_DIGEST_ALGORITHM,
  DEMO_SIGNATURE_ALGORITHM,
} from "./demo-signer";
export { InMemoryPackageRegistry } from "./in-memory-package-registry";
export { InMemorySignatureStore } from "./in-memory-signature-store";
export { DefaultCompositionPipeline } from "./default-composition-pipeline";
export type { DefaultCompositionPipelineDeps } from "./default-composition-pipeline";
export { DefaultPackageInstaller } from "./default-package-installer";
export type { DefaultPackageInstallerDeps } from "./default-package-installer";

import type { OperationalPackage } from "../domain";
import type { CompositionInput, CompositionResult } from "../domain";
import type { InstallResult } from "../application/install-package";
import { InMemoryPackageRegistry } from "./in-memory-package-registry";
import { InMemorySignatureStore } from "./in-memory-signature-store";
import {
  DemoDigestProvider,
  DemoSigner,
  DemoVerifier,
} from "./demo-signer";
import { DefaultCompositionPipeline } from "./default-composition-pipeline";
import { DefaultPackageInstaller } from "./default-package-installer";

/**
 * A convenience bundle of every in-memory composition component.
 *
 * Construct one per composition session and pass the components individually
 * to use-cases (`compileProtocol`, `validatePackage`, `installPackage`).
 *
 * The bundle pre-wires:
 *   - the `DefaultCompositionPipeline` with the demo digest provider + demo
 *     signer + demo verifier + signature store + package registry.
 *   - the `DefaultPackageInstaller` with the demo verifier + signature store +
 *     package registry (for rollback lookups).
 *
 * Convenience methods (`compile`, `install`, `activate`, `disable`, `remove`,
 * `rollback`, `upgrade`, `register`) are thin pass-throughs to the underlying
 * components.
 */
export interface InMemoryComposition {
  readonly registry: InMemoryPackageRegistry;
  readonly signatureStore: InMemorySignatureStore;
  readonly digestProvider: DemoDigestProvider;
  readonly signer: DemoSigner;
  readonly verifier: DemoVerifier;
  readonly pipeline: DefaultCompositionPipeline;
  readonly installer: DefaultPackageInstaller;

  /** Convenience: compile a protocol into an `OperationalPackage`. */
  compile(input: CompositionInput): Promise<CompositionResult>;
  /** Convenience: register a built package in the registry. */
  register(pkg: OperationalPackage): void;
  /** Convenience: install a package. */
  install(pkg: OperationalPackage): InstallResult;
  /** Convenience: activate a package version. */
  activate(packageId: string, version: string): InstallResult;
  /** Convenience: disable a package version. */
  disable(packageId: string, version: string): InstallResult;
  /** Convenience: remove a package version. */
  remove(packageId: string, version: string): InstallResult;
  /** Convenience: rollback to an older version. */
  rollback(packageId: string, toVersion: string): InstallResult;
  /** Convenience: upgrade to a new package version. */
  upgrade(packageId: string, newPkg: OperationalPackage): InstallResult;
}

/**
 * Construct a fresh bundle of in-memory composition components. Each
 * component is a new instance with empty state. The pipeline and installer
 * are pre-wired to share the registry, signature store, digest provider,
 * signer, and verifier.
 *
 * @param signerId optional signer id for the demo signer (default
 *                  `"demo-signer"`).
 */
export function createInMemoryComposition(
  signerId: string = "demo-signer"
): InMemoryComposition {
  const registry = new InMemoryPackageRegistry();
  const signatureStore = new InMemorySignatureStore();
  const digestProvider = new DemoDigestProvider();
  const signer = new DemoSigner(signerId);
  const verifier = new DemoVerifier();
  const pipeline = new DefaultCompositionPipeline({
    digestProvider,
    signer,
    verifier,
    signatureStore,
    // installedPackages is left empty; callers can supply a richer deps
    // object directly if they need cross-package dependency checking.
  });
  const installer = new DefaultPackageInstaller({
    registry,
    verifier,
    signatureStore,
  });
  return {
    registry,
    signatureStore,
    digestProvider,
    signer,
    verifier,
    pipeline,
    installer,
    compile: (input) => pipeline.compile(input),
    register: (pkg) => registry.register(pkg),
    install: (pkg) => installer.install(pkg),
    activate: (id, v) => installer.activate(id, v),
    disable: (id, v) => installer.disable(id, v),
    remove: (id, v) => installer.remove(id, v),
    rollback: (id, v) => installer.rollback(id, v),
    upgrade: (id, pkg) => installer.upgrade(id, pkg),
  };
}
