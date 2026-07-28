/**
 * @kernel/composition/application/validate-package — `validatePackage()`.
 *
 * Re-runs every validator on an already-assembled `OperationalPackage` and
 * returns the full `CompositionDiagnostics`. This is useful when a package is
 * received from an external source (e.g. imported from disk) and the caller
 * wants to verify it independently of the pipeline that built it.
 *
 * The validators invoked are: semantic integrity (entity refs), knowledge
 * integrity, resource integrity, workflow integrity, policy integrity,
 * extension integrity, and the dependency graph (cycles, version compat).
 *
 * Pure given the validator deps. No I/O.
 */

import type { OperationalPackage } from "../domain";
import type { PackageDiagnostic } from "../domain";
import type { CompositionDiagnostics } from "../domain";
import { compositionDiagnostics } from "../domain";

/**
 * Deps for `validatePackage` — the validator implementation (the same
 * `CompositionValidator` used by the pipeline).
 */
export interface ValidatePackageDeps {
  /**
   * Validate the package's contents and return diagnostics.
   * The validator SHOULD NOT throw; it MUST return diagnostics.
   */
  readonly validate: (pkg: OperationalPackage) => readonly PackageDiagnostic[];
}

/** Result of `validatePackage`. */
export interface ValidatePackageResult {
  readonly diagnostics: CompositionDiagnostics;
  readonly ok: boolean;
}

/**
 * `validatePackage` — re-run all validators on an assembled package.
 *
 * Returns `{ ok, diagnostics }` where `ok` is true iff no error/fatal
 * diagnostics were produced.
 */
export function validatePackage(
  pkg: OperationalPackage,
  deps: ValidatePackageDeps
): ValidatePackageResult {
  const diags = deps.validate(pkg);
  const view = compositionDiagnostics(diags);
  return { diagnostics: view, ok: !view.hasErrors };
}

/** OO-style wrapper. */
export class ValidatePackageUseCase {
  constructor(private readonly deps: ValidatePackageDeps) {}

  validate(pkg: OperationalPackage): ValidatePackageResult {
    return validatePackage(pkg, this.deps);
  }
}
