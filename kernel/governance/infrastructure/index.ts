/**
 * @kernel/governance/infrastructure — barrel + `createGovernanceFramework()`.
 *
 * Re-exports the default in-memory registry, the default engines, the internal
 * semver utility, and a `createGovernanceFramework()` factory that wires them
 * together into a coherent bundle sharing one clock.
 */

export { InMemoryGovernanceRegistry } from "./in-memory-governance-registry";
export {
  DefaultCompatibilityEngine,
  type DefaultCompatibilityEngineOptions,
} from "./default-compatibility-engine";
export {
  DefaultMigrationEngine,
} from "./default-migration-engine";
export {
  DefaultCertificationEngine,
  type DefaultCertificationEngineOptions,
} from "./default-certification-engine";
export {
  parseSemver,
  isValidSemver,
  compareSemver,
  compareSemverStrings,
  satisfiesRange,
  type ParsedSemver,
} from "./semver";

import type { RuntimeClock } from "@kernel/shared-kernel";
import { InMemoryGovernanceRegistry } from "./in-memory-governance-registry";
import { DefaultCompatibilityEngine } from "./default-compatibility-engine";
import { DefaultMigrationEngine } from "./default-migration-engine";
import { DefaultCertificationEngine } from "./default-certification-engine";

/** Options for `createGovernanceFramework()`. */
export interface CreateGovernanceFrameworkOptions {
  /**
   * Optional clock shared across the certification engine (and available to
   * callers via the returned bundle). Default: a zero clock (returns 0).
   */
  readonly clock?: RuntimeClock;
}

/**
 * A wired bundle of governance components sharing one registry and one clock.
 *
 * The registry, compatibility engine, certification engine, and migration
 * engine are all created fresh; the compatibility engine is given a reference
 * to the registry so it can look up declared `supportedRanges`.
 */
export interface GovernanceFramework {
  readonly registry: InMemoryGovernanceRegistry;
  readonly compatibilityEngine: DefaultCompatibilityEngine;
  readonly migrationEngine: DefaultMigrationEngine;
  readonly certificationEngine: DefaultCertificationEngine;
  /** The clock the bundle was wired with (may be the zero clock). */
  readonly clock: RuntimeClock;
}

/**
 * A no-op clock used when the caller does not inject one. Returns 0 forever.
 * Exposed so callers can pass the same zero clock to other components.
 */
export class GovernanceZeroClock implements RuntimeClock {
  now(): number {
    return 0;
  }
  tick(): number {
    return 0;
  }
}

/**
 * Build a fresh governance framework: an in-memory registry + the three
 * default engines, all sharing one clock. Deterministic: identical options
 * produce identical-behaving bundles.
 */
export function createGovernanceFramework(
  options: CreateGovernanceFrameworkOptions = {}
): GovernanceFramework {
  const clock = options.clock ?? new GovernanceZeroClock();
  const registry = new InMemoryGovernanceRegistry();
  const compatibilityEngine = new DefaultCompatibilityEngine({ registry });
  const migrationEngine = new DefaultMigrationEngine();
  const certificationEngine = new DefaultCertificationEngine({ clock });
  return {
    registry,
    compatibilityEngine,
    migrationEngine,
    certificationEngine,
    clock,
  };
}
