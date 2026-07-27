/**
 * @kernel/governance/domain/migration — the migration contract.
 *
 * A migration moves an installed artifact from one version to another. The
 * framework PLANS migrations (produces a deterministic, auditable `MigrationPlan`
 * of named steps) and EXECUTES them (produces a `MigrationResult` recording
 * what was completed and what failed).
 *
 * Migration types:
 *   - `upgrade`:        move to a NEWER version.
 *   - `downgrade`:      move to an OLDER version (rare; only when an upgrade misbehaves).
 *   - `rollback`:       revert to the PREVIOUS version after a failed change.
 *   - `staged-rollout`: roll out incrementally (1% → 10% → 50% → 100%).
 *   - `canary`:         deploy to a small canary fleet first, monitor, then promote.
 *
 * `dryRun` produces a `MigrationResult` WITHOUT side effects — the same plan
 * run twice in dry-run mode yields byte-identical results. `execute` performs
 * the migration (in the in-memory implementation, this is a deterministic
 * simulation; production engines wrap real artifact managers).
 *
 * Pure domain layer. No I/O, no Date.now(), no Math.random().
 */

/**
 * The five migration types the framework can plan and execute.
 */
export type MigrationType =
  | "upgrade"
  | "downgrade"
  | "rollback"
  | "staged-rollout"
  | "canary";

/**
 * A single step in a migration plan. Steps are ordered (1-based) and named.
 * `estimatedDurationMs` is an OPTIONAL, informational estimate (derived from
 * the migration type and step kind, NOT from wall-clock measurement — the
 * deterministic core never calls Date.now()).
 */
export interface MigrationStep {
  /** 1-based step order. */
  readonly order: number;
  /** Machine-readable action identifier (e.g. `"snapshot"`, `"pre-check"`, `"apply"`, `"verify"`). */
  readonly action: string;
  /** Human-readable description of what the step does. */
  readonly description: string;
  /** Optional estimated duration in milliseconds. */
  readonly estimatedDurationMs?: number;
}

/**
 * A deterministic migration plan.
 *
 * `id` is deterministically derived from `(type, fromVersion, toVersion)` so
 * the same inputs always produce the same plan id. `dryRun` flags whether the
 * plan was produced for a dry run (informational; the engine honours the flag
 * at execution time). `rollbackPlan` references the id of the plan that would
 * roll this migration back, if applicable.
 */
export interface MigrationPlan {
  /** Deterministic plan id. */
  readonly id: string;
  /** The migration type. */
  readonly type: MigrationType;
  /** The version being migrated from. */
  readonly fromVersion: string;
  /** The version being migrated to. */
  readonly toVersion: string;
  /** The ordered steps. */
  readonly steps: readonly MigrationStep[];
  /** True iff this plan was produced for a dry run. */
  readonly dryRun: boolean;
  /** Optional id of the rollback plan. */
  readonly rollbackPlan?: string;
}

/**
 * The outcome of executing (or dry-running) a migration plan.
 *
 * `ok` is the headline boolean. `completedSteps` / `totalSteps` report
 * progress. `warnings` and `errors` carry human-readable messages; a plan
 * with `errors.length > 0` always has `ok === false`.
 */
export interface MigrationResult {
  /** The id of the plan this result corresponds to. */
  readonly planId: string;
  /** True iff the migration completed without errors. */
  readonly ok: boolean;
  /** How many steps completed successfully. */
  readonly completedSteps: number;
  /** Total steps in the plan. */
  readonly totalSteps: number;
  /** Non-fatal warnings. */
  readonly warnings: readonly string[];
  /** Fatal errors (empty iff `ok === true`). */
  readonly errors: readonly string[];
}

/**
 * The MigrationEngine PORT.
 *
 * `plan` is PURE — same inputs always produce the same plan.
 * `dryRun` is PURE — same plan always produces the same result, with NO side effects.
 * `execute` performs the migration; in the in-memory default implementation
 * this is a deterministic simulation (no real artifact mutation).
 */
export interface MigrationEngine {
  /** Plan a migration from `from` to `to` of the given type. Pure. */
  plan(from: string, to: string, type: MigrationType): MigrationPlan;
  /** Dry-run a plan: produce a result WITHOUT side effects. Pure. */
  dryRun(plan: MigrationPlan): MigrationResult;
  /** Execute a plan: produce a result reflecting actual completion. */
  execute(plan: MigrationPlan): MigrationResult;
}
