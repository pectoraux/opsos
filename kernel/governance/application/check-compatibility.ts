/**
 * @kernel/governance/application/check-compatibility — use-case: check
 * compatibility between artifacts.
 *
 * Resolves `VersionArtifact`s from the registry for each side of a
 * `CompatibilityCheck`, delegates to the `CompatibilityEngine`, and records
 * the result into the registry's evolution history (so `getEvolutionHistory`
 * can surface past compatibility checks).
 *
 * The use-case is a thin orchestrator: it knows the registry + engine ports,
 * nothing more. It is deterministic given its inputs.
 */

import type { CompatibilityCheck, CompatibilityResult } from "../domain/compatibility";
import type { CompatibilityEngine } from "../domain/compatibility";
import type { GovernanceRegistry } from "../domain/governance-registry";
import type { RuntimeClock } from "@kernel/shared-kernel";

/** Dependencies injected into the use-case. */
export interface CheckCompatibilityDeps {
  readonly registry: GovernanceRegistry;
  readonly engine: CompatibilityEngine;
  /** Optional clock for recording when checks happened. Default: a clock returning 0. */
  readonly clock?: RuntimeClock;
}

/** Input to the use-case. */
export interface CheckCompatibilityInput {
  /** The checks to perform. */
  readonly checks: readonly CompatibilityCheck[];
  /**
   * Optional epoch-millis timestamp to stamp onto recorded history. If absent,
   * `deps.clock?.now() ?? 0` is used. NEVER Date.now().
   */
  readonly at?: number;
}

/**
 * Run a batch of compatibility checks.
 *
 * Returns the engine's results verbatim, in input order. As a side effect,
 * each result is recorded into the registry's evolution history (against the
 * source version of its check) so subsequent `getEvolutionHistory` calls can
 * surface past checks. Recording is best-effort: if the source version is not
 * registered, the result is simply not recorded.
 */
export function checkCompatibility(
  deps: CheckCompatibilityDeps,
  input: CheckCompatibilityInput
): readonly CompatibilityResult[] {
  const results = deps.engine.check(input.checks);
  const at = input.at ?? deps.clock?.now() ?? 0;
  // Best-effort recording into the registry's evolution history.
  if (typeof (deps.registry as { recordCompatibility?: unknown }).recordCompatibility === "function") {
    for (const r of results) {
      (deps.registry as unknown as {
        recordCompatibility(
          sourceId: string,
          sourceVersion: string,
          targetVersion: string,
          compatible: boolean,
          at: number
        ): void;
      }).recordCompatibility(
        r.check.source.id,
        r.check.source.version,
        r.check.target.version,
        r.compatible,
        at
      );
    }
  }
  return results;
}

/**
 * Use-case class wrapping `checkCompatibility` for callers that prefer an
 * OO style. Stateless aside from its injected deps.
 */
export class CheckCompatibility {
  constructor(private readonly deps: CheckCompatibilityDeps) {}

  run(input: CheckCompatibilityInput): readonly CompatibilityResult[] {
    return checkCompatibility(this.deps, input);
  }
}
