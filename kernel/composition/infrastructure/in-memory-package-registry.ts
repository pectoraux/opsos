/**
 * @kernel/composition/infrastructure/in-memory-package-registry —
 * `InMemoryPackageRegistry`.
 *
 * The in-memory `PackageRegistry` implementation. Pure data structures.
 *
 * Storage:
 *   - `Map<id, Map<version, OperationalPackage>>` — primary store, supports
 *     O(1) lookup by `(id, version)`.
 *   - `Map<domainId, Set<id>>` — domain → id index (for `listByDomain`).
 *     Indexed by every `domainBindings` value.
 *   - `Map<protocolId, Set<id>>` — protocol-source id → id index. The
 *     `manifest.id` IS the protocol id (packages keep their source protocol's
 *     id by default), so this index maps `manifest.id → {id}` (a singleton in
 *     the common case, but supports repackaged packages whose id differs).
 *
 * `register` is idempotent per `(id, version)` — re-registering replaces in
 * place. `list` returns the LATEST version per id (highest semver).
 *
 * Determinism: every list method returns results sorted by id lexicographic
 * ASC, then by version semver ASC (for `getVersionHistory`). No `Date.now()`,
 * no `Math.random()`.
 */

import type { OperationalPackage } from "../domain";
import type { PackageRegistry } from "../domain";
import { compareSemverStrings } from "./dependency-resolver";

export class InMemoryPackageRegistry implements PackageRegistry {
  private readonly byId = new Map<string, Map<string, OperationalPackage>>();
  private readonly byDomain = new Map<string, Set<string>>();
  private readonly byProtocol = new Map<string, Set<string>>();

  register(pkg: OperationalPackage): void {
    const id = pkg.manifest.id;
    const version = pkg.manifest.version;
    let versions = this.byId.get(id);
    if (!versions) {
      versions = new Map();
      this.byId.set(id, versions);
    }
    versions.set(version, pkg);
    // Domain index — every value in domainBindings.
    for (const domainId of Object.values(pkg.contents.domainBindings)) {
      let set = this.byDomain.get(domainId);
      if (!set) {
        set = new Set();
        this.byDomain.set(domainId, set);
      }
      set.add(id);
    }
    // Protocol index — manifest.id is the protocol source id.
    let pset = this.byProtocol.get(id);
    if (!pset) {
      pset = new Set();
      this.byProtocol.set(id, pset);
    }
    pset.add(id);
  }

  get(id: string, version: string): OperationalPackage | undefined {
    return this.byId.get(id)?.get(version);
  }

  list(): readonly OperationalPackage[] {
    const out: OperationalPackage[] = [];
    for (const versions of this.byId.values()) {
      const latest = this.pickLatest(versions);
      if (latest) out.push(latest);
    }
    out.sort((a, b) =>
      a.manifest.id < b.manifest.id ? -1 : a.manifest.id > b.manifest.id ? 1 : 0
    );
    return out;
  }

  listByDomain(domainId: string): readonly OperationalPackage[] {
    const set = this.byDomain.get(domainId);
    if (!set) return [];
    const out: OperationalPackage[] = [];
    for (const id of set) {
      const versions = this.byId.get(id);
      if (!versions) continue;
      const latest = this.pickLatest(versions);
      if (latest) out.push(latest);
    }
    out.sort((a, b) =>
      a.manifest.id < b.manifest.id ? -1 : a.manifest.id > b.manifest.id ? 1 : 0
    );
    return out;
  }

  listByProtocol(protocolId: string): readonly OperationalPackage[] {
    const set = this.byProtocol.get(protocolId);
    if (!set) return [];
    const out: OperationalPackage[] = [];
    for (const id of set) {
      const versions = this.byId.get(id);
      if (!versions) continue;
      const latest = this.pickLatest(versions);
      if (latest) out.push(latest);
    }
    out.sort((a, b) =>
      a.manifest.id < b.manifest.id ? -1 : a.manifest.id > b.manifest.id ? 1 : 0
    );
    return out;
  }

  getVersionHistory(id: string): readonly OperationalPackage[] {
    const versions = this.byId.get(id);
    if (!versions) return [];
    const out: OperationalPackage[] = Array.from(versions.values());
    out.sort((a, b) =>
      compareSemverStrings(a.manifest.version, b.manifest.version)
    );
    return out;
  }

  getLatest(id: string): OperationalPackage | undefined {
    const versions = this.byId.get(id);
    if (!versions) return undefined;
    return this.pickLatest(versions);
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private pickLatest(
    versions: Map<string, OperationalPackage>
  ): OperationalPackage | undefined {
    let latest: OperationalPackage | undefined;
    for (const pkg of versions.values()) {
      if (!latest) {
        latest = pkg;
        continue;
      }
      if (compareSemverStrings(pkg.manifest.version, latest.manifest.version) > 0) {
        latest = pkg;
      }
    }
    return latest;
  }
}
