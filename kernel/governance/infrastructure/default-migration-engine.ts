/**
 * @kernel/governance/infrastructure/default-migration-engine — the default
 * `MigrationEngine` implementation.
 *
 * Produces deterministic `MigrationPlan`s for the five migration types
 * (upgrade, downgrade, rollback, staged-rollout, canary). Each plan is a fixed
 * sequence of named steps with deterministic estimated durations (derived
 * from the step kind, NOT from wall-clock measurement — the deterministic core
 * never calls `Date.now()`).
 *
 * `dryRun` and `execute` produce `MigrationResult`s. In the in-memory default
 * implementation, both are deterministic simulations: `dryRun` reports all
 * steps completed without side effects; `execute` does the same (production
 * engines wrap real artifact managers and may produce real errors here).
 *
 * Plan ids are deterministic: `mig-${hashSeed(type|from|to).toString(16)}`.
 * The same `(from, to, type)` triple ALWAYS produces the same plan id.
 *
 * Pure and deterministic: same inputs always produce the same outputs.
 */

import type {
  MigrationEngine,
  MigrationPlan,
  MigrationResult,
  MigrationStep,
  MigrationType,
} from "../domain/migration";
import { hashSeed } from "@kernel/shared-kernel";

/** Per-step estimated durations (ms), deterministically fixed per action kind. */
const STEP_DURATION_MS: Readonly<Record<string, number>> = {
  snapshot: 500,
  "pre-check": 200,
  "compatibility-check": 300,
  "dry-run": 800,
  apply: 2000,
  "apply-1pct": 1500,
  "apply-10pct": 1800,
  "apply-50pct": 2200,
  "apply-100pct": 2500,
  "deploy-canary": 1500,
  monitor: 5000,
  promote: 1500,
  revert: 2000,
  verify: 400,
  cleanup: 100,
};

/** Build a step. Pure helper. */
function step(
  order: number,
  action: string,
  description: string
): MigrationStep {
  return {
    order,
    action,
    description,
    estimatedDurationMs: STEP_DURATION_MS[action] ?? 0,
  };
}

/** Deterministic plan id from (type, from, to). */
function planId(type: MigrationType, from: string, to: string): string {
  const h = hashSeed(`${type}|${from}|${to}`).toString(16);
  return `mig-${type}-${h}`;
}

/** The five plan builders. Each returns the ordered steps for its type. */
function buildSteps(
  type: MigrationType,
  from: string,
  to: string
): readonly MigrationStep[] {
  switch (type) {
    case "upgrade":
      return [
        step(1, "snapshot", `Snapshot current state at ${from}`),
        step(2, "pre-check", `Pre-check: verify ${from} → ${to} is a valid upgrade`),
        step(3, "compatibility-check", `Verify compatibility of ${to} with declared ranges`),
        step(4, "apply", `Apply upgrade ${from} → ${to}`),
        step(5, "verify", `Verify post-upgrade state at ${to}`),
        step(6, "cleanup", `Release snapshot resources`),
      ];
    case "downgrade":
      return [
        step(1, "snapshot", `Snapshot current state at ${from}`),
        step(2, "pre-check", `Pre-check: verify ${from} → ${to} is a valid downgrade`),
        step(3, "compatibility-check", `Verify compatibility of ${to} with declared ranges`),
        step(4, "apply", `Apply downgrade ${from} → ${to}`),
        step(5, "verify", `Verify post-downgrade state at ${to}`),
        step(6, "cleanup", `Release snapshot resources`),
      ];
    case "rollback":
      return [
        step(1, "snapshot", `Snapshot current (failed) state at ${from}`),
        step(2, "pre-check", `Pre-check: verify rollback target ${to} is reachable`),
        step(3, "revert", `Revert state ${from} → ${to}`),
        step(4, "verify", `Verify post-rollback state at ${to}`),
        step(5, "cleanup", `Release snapshot resources`),
      ];
    case "staged-rollout":
      return [
        step(1, "snapshot", `Snapshot current state at ${from}`),
        step(2, "pre-check", `Pre-check: verify staged rollout ${from} → ${to}`),
        step(3, "compatibility-check", `Verify compatibility of ${to} with declared ranges`),
        step(4, "apply-1pct", `Roll out ${to} to 1% of fleet`),
        step(5, "monitor", `Monitor 1% rollout for anomalies`),
        step(6, "apply-10pct", `Roll out ${to} to 10% of fleet`),
        step(7, "monitor", `Monitor 10% rollout for anomalies`),
        step(8, "apply-50pct", `Roll out ${to} to 50% of fleet`),
        step(9, "monitor", `Monitor 50% rollout for anomalies`),
        step(10, "apply-100pct", `Roll out ${to} to 100% of fleet`),
        step(11, "verify", `Verify post-rollout state at ${to}`),
        step(12, "cleanup", `Release snapshot resources`),
      ];
    case "canary":
      return [
        step(1, "snapshot", `Snapshot current state at ${from}`),
        step(2, "pre-check", `Pre-check: verify canary ${from} → ${to}`),
        step(3, "compatibility-check", `Verify compatibility of ${to} with declared ranges`),
        step(4, "deploy-canary", `Deploy ${to} to canary fleet`),
        step(5, "monitor", `Monitor canary for anomalies`),
        step(6, "promote", `Promote ${to} from canary to production`),
        step(7, "verify", `Verify post-promotion state at ${to}`),
        step(8, "cleanup", `Release snapshot resources`),
      ];
    default: {
      // Exhaustiveness guard. Should never be reached.
      const _exhaustive: never = type;
      void _exhaustive;
      return [];
    }
  }
}

/** Determine the migration type implied by (from, to) semver comparison. */
function inferType(from: string, to: string): MigrationType {
  // Pure heuristic for the rollback-plan computation; not used to override the
  // caller-supplied type.
  return from === to ? "rollback" : "upgrade";
}

/**
 * The default in-memory `MigrationEngine`. Stateless.
 */
export class DefaultMigrationEngine implements MigrationEngine {
  /** @inheritdoc */
  plan(from: string, to: string, type: MigrationType): MigrationPlan {
    const steps = buildSteps(type, from, to);
    const id = planId(type, from, to);
    // The rollback plan is the rollback-migration from `to` back to `from`.
    const rollbackPlan =
      type === "rollback" ? undefined : planId("rollback", to, from);
    void inferType; // referenced for completeness; not currently used to mutate the type
    return {
      id,
      type,
      fromVersion: from,
      toVersion: to,
      steps,
      dryRun: false,
      rollbackPlan,
    };
  }

  /** @inheritdoc */
  dryRun(plan: MigrationPlan): MigrationResult {
    // Dry-run: all steps complete, no warnings, no errors. The dry-run flag on
    // the plan is informational; we honour it by NOT recording any execution
    // side effects (this default implementation has no side effects anyway).
    return {
      planId: plan.id,
      ok: true,
      completedSteps: plan.steps.length,
      totalSteps: plan.steps.length,
      warnings: [],
      errors: [],
    };
  }

  /** @inheritdoc */
  execute(plan: MigrationPlan): MigrationResult {
    // Execute: in the in-memory default, this is the same deterministic
    // simulation as dry-run. Production engines wrap real artifact managers
    // and may produce real errors here.
    return {
      planId: plan.id,
      ok: true,
      completedSteps: plan.steps.length,
      totalSteps: plan.steps.length,
      warnings: [],
      errors: [],
    };
  }
}
