/**
 * @kernel/composition/application/install-package — `PackageInstaller`
 * interface + `installPackage` use-case.
 *
 * Installs an `OperationalPackage` into an Application Runtime, then drives
 * its lifecycle: `install → activate → disable → remove → rollback → upgrade`.
 * Every transition emits a `PackageLifecycleEvent`; illegal transitions are
 * refused with a diagnostic.
 *
 * The installer is a USE-CASE in the application layer — it depends on a
 * `PackageInstaller` port (declared here) whose default implementation is
 * `DefaultPackageInstaller` in `infrastructure/default-package-installer.ts`.
 *
 * Pure given the installer deps. No I/O, no `Date.now()` (the `now` argument
 * flows through).
 */

import type {
  OperationalPackage,
  PackageDiagnostic,
  PackageLifecycleEvent,
} from "../domain";

/**
 * Result of an installer operation (`install`, `activate`, `disable`,
 * `remove`, `rollback`, `upgrade`).
 *
 *   `ok`           — true iff the operation completed successfully.
 *   `packageId`    — the package id the operation targeted.
 *   `version`      — the package version the operation targeted.
 *   `lifecycle`    — the sequence of lifecycle events produced (in order).
 *   `diagnostics`  — any diagnostics produced (illegal transitions, missing
 *                    deps, signature failures, …).
 */
export interface InstallResult {
  readonly ok: boolean;
  readonly packageId: string;
  readonly version: string;
  readonly lifecycle: readonly PackageLifecycleEvent[];
  readonly diagnostics: readonly PackageDiagnostic[];
}

/**
 * PORT `PackageInstaller` — installs packages and drives their lifecycle.
 *
 * Implementations MAY be async (a real installer may need to await a runtime
 * activation); the demo installer is synchronous.
 */
export interface PackageInstaller {
  install(pkg: OperationalPackage): Promise<InstallResult> | InstallResult;
  activate(packageId: string, version: string): InstallResult;
  disable(packageId: string, version: string): InstallResult;
  remove(packageId: string, version: string): InstallResult;
  rollback(packageId: string, toVersion: string): InstallResult;
  upgrade(packageId: string, newPkg: OperationalPackage): InstallResult;
}

/**
 * Deps for `installPackage` (the use-case wrapper around `PackageInstaller`).
 */
export interface InstallPackageDeps {
  readonly installer: PackageInstaller;
}

/**
 * `installPackage` — the install use-case. Thin wrapper that delegates to
 * the injected `PackageInstaller.install`.
 */
export function installPackage(
  pkg: OperationalPackage,
  deps: InstallPackageDeps
): Promise<InstallResult> | InstallResult {
  return deps.installer.install(pkg);
}

/** OO-style wrapper. */
export class InstallPackageUseCase {
  constructor(private readonly deps: InstallPackageDeps) {}

  install(pkg: OperationalPackage): Promise<InstallResult> | InstallResult {
    return installPackage(pkg, this.deps);
  }
}
