/**
 * @kernel/governance/application/plan-migration — use-case: plan a migration
 * from one version to another.
 *
 * Delegates to the `MigrationEngine` to produce a `MigrationPlan`, optionally
 * dry-runs it, and (on execute) records the migration into the registry's
 * evolution history so `getEvolutionHistory` can surface past migrations.
 *
 * The use-case is a thin orchestrator. It is deterministic given its inputs.
 */

import type { MigrationType, MigrationPlan, MigrationResult } from "../domain/migration";
import type { MigrationEngine } from "../domain/migration";
import type { GovernanceRegistry } from "../domain/governance-registry";
import type { RuntimeClock } from "@kernel/shared-kernel";

/** Dependencies injected into the use-case. */
export interface PlanMigrationDeps {
  readonly registry: GovernanceRegistry;
  readonly engine: MigrationEngine;
  /** Optional clock for recording when migrations happened. Default: a clock returning 0. */
  readonly clock?: RuntimeClock;
}

/** Input to the plan-only operation. */
export interface PlanMigrationInput {
  /** The version being migrated from. */
  readonly from: string;
  /** The version being migrated to. */
  readonly to: string;
  /** The migration type. */
  readonly type: MigrationType;
  /** The artifact id (used only for recording history). */
  readonly artifactId?: string;
}

/** Input to the dry-run operation. */
export interface DryRunMigrationInput extends PlanMigrationInput {
  /** The plan to dry-run. If omitted, a plan is derived from (from, to, type). */
  readonly plan?: MigrationPlan;
}

/** Input to the execute operation. */
export interface ExecuteMigrationInput {
  /** The plan to execute. */
  readonly plan: MigrationPlan;
  /** The artifact id (used only for recording history). */
  readonly artifactId?: string;
  /**
   * Optional epoch-millis timestamp to stamp onto recorded history. If absent,
   * `deps.clock?.now() ?? 0` is used. NEVER Date.now().
   */
  readonly at?: number;
}

/**
 * Plan a migration. Pure delegation to the engine. Returns the plan.
 */
export function planMigration(
  deps: PlanMigrationDeps,
  input: PlanMigrationInput
): MigrationPlan {
  return deps.engine.plan(input.from, input.to, input.type);
}

/**
 * Dry-run a migration. Pure delegation to the engine. Returns the result
 * WITHOUT side effects.
 */
export function dryRunMigration(
  deps: PlanMigrationDeps,
  input: DryRunMigrationInput
): MigrationResult {
  const plan = input.plan ?? deps.engine.plan(input.from, input.to, input.type);
  return deps.engine.dryRun(plan);
}

/**
 * Execute a migration. Performs the migration via the engine and records the
 * outcome into the registry's evolution history (best-effort: if the artifact
 * id is supplied AND the registry exposes the internal `recordMigration`
 * extension, the migration is recorded).
 */
export function executeMigration(
  deps: PlanMigrationDeps,
  input: ExecuteMigrationInput
): MigrationResult {
  const result = deps.engine.execute(input.plan);
  const at = input.at ?? deps.clock?.now() ?? 0;
  if (
    input.artifactId &&
    typeof (deps.registry as { recordMigration?: unknown }).recordMigration === "function"
  ) {
    (deps.registry as unknown as {
      recordMigration(
        artifactId: string,
        from: string,
        to: string,
        at: number,
        type: string
      ): void;
    }).recordMigration(
      input.artifactId,
      input.plan.fromVersion,
      input.plan.toVersion,
      at,
      input.plan.type
    );
  }
  return result;
}

/**
 * Use-case class wrapping the three migration operations for callers that
 * prefer an OO style. Stateless aside from its injected deps.
 */
export class PlanMigration {
  constructor(private readonly deps: PlanMigrationDeps) {}

  plan(input: PlanMigrationInput): MigrationPlan {
    return planMigration(this.deps, input);
  }

  dryRun(input: DryRunMigrationInput): MigrationResult {
    return dryRunMigration(this.deps, input);
  }

  execute(input: ExecuteMigrationInput): MigrationResult {
    return executeMigration(this.deps, input);
  }
}
