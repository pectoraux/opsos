/**
 * @kernel/composition/domain/package-registry — the `PackageRegistry` PORT.
 *
 * The registry stores built `OperationalPackage`s keyed by `(id, version)`.
 * It supports lookup by id+version, listing all, listing by domain, listing
 * by source protocol, version history per id, and the latest version per id.
 *
 * Implementations live in `infrastructure/in-memory-package-registry.ts`.
 *
 * Pure domain layer (interface declaration only).
 */

import type { OperationalPackage } from "./operational-package";

/**
 * PORT `PackageRegistry` — stores built packages and answers queries.
 *
 * Determinism rules (enforced by implementations):
 *   - `register` is idempotent: registering the same `(id, version)` twice
 *     replaces the existing entry in place.
 *   - `list`, `listByDomain`, `listByProtocol`, `getVersionHistory` return
 *     results sorted by `id` lexicographic ASC, then by `version` semver ASC
 *     (for version history).
 *   - `getLatest(id)` returns the highest semver version registered for `id`,
 *     or `undefined` if no versions exist.
 */
export interface PackageRegistry {
  /** Register (or replace) a package. Idempotent per `(id, version)`. */
  register(pkg: OperationalPackage): void;
  /** Look up a specific `(id, version)`. */
  get(id: string, version: string): OperationalPackage | undefined;
  /** List every registered package (latest per `(id, version)`). */
  list(): readonly OperationalPackage[];
  /** List packages whose `contents.domainBindings` includes the given domain. */
  listByDomain(domainId: string): readonly OperationalPackage[];
  /** List packages whose source `manifest.id` matches the given protocol id. */
  listByProtocol(protocolId: string): readonly OperationalPackage[];
  /** Version history for an id, sorted by semver ASC. */
  getVersionHistory(id: string): readonly OperationalPackage[];
  /** The highest semver version registered for an id, or undefined. */
  getLatest(id: string): OperationalPackage | undefined;
}
