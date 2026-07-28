/**
 * @kernel/composition/infrastructure/in-memory-signature-store —
 * `InMemorySignatureStore`.
 *
 * The in-memory `SignatureStore` implementation. Pure data structures.
 *
 * Storage: `Map<id, Map<version, PackageSignature>>`. Save is idempotent;
 * re-saving replaces in place.
 *
 * `verify(id, version)` returns true iff a signature has been saved for the
 * `(id, version)` pair. It does NOT cryptographically verify — that is the
 * `Verifier` port's job. The store only answers "did we record a signature
 * for this package?".
 *
 * Determinism: no `Date.now()`, no `Math.random()`.
 */

import type { OperationalPackage } from "../domain";
import type { PackageSignature } from "../domain";
import type { SignatureStore } from "../domain";

export class InMemorySignatureStore implements SignatureStore {
  private readonly store = new Map<string, Map<string, PackageSignature>>();

  save(pkg: OperationalPackage): void {
    if (!pkg.signature) return;
    const id = pkg.manifest.id;
    const version = pkg.manifest.version;
    let versions = this.store.get(id);
    if (!versions) {
      versions = new Map();
      this.store.set(id, versions);
    }
    versions.set(version, pkg.signature);
  }

  verify(id: string, version: string): boolean {
    return this.store.get(id)?.has(version) ?? false;
  }
}
