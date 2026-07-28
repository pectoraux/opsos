/**
 * @kernel/ai-workforce/domain/autonomous-boundaries — AutonomousBoundaries +
 * the BoundaryChecker PORT.
 *
 * `AutonomousBoundaries` is the cost / scope / action envelope inside which
 * an agent may act WITHOUT human approval. It is the safety rail that lets
 * AI be autonomous without being unaccountable.
 *
 * Fields:
 *   - `maxDecisionCost`           — the maximum cost an agent may spend on a
 *                                    single decision autonomously.
 *   - `requiresApprovalAbove`     — decisions costing more than this REQUIRE
 *                                    human approval (overrides maxDecisionCost
 *                                    for the approval gate).
 *   - `allowedActions`            — a whitelist of action-types the agent may
 *                                    take autonomously.
 *   - `forbiddenActions`          — a blacklist of action-types the agent may
 *                                    NEVER take (even with approval — these
 *                                    are absolute prohibitions).
 *   - `maxAutonomousDurationMs`   — the maximum wall-clock duration an agent
 *                                    may run autonomously before checkpointing
 *                                    with a human.
 *   - `escalationOnTimeout`       — if true, hitting `maxAutonomousDurationMs`
 *                                    triggers an escalation (vs. a soft warn).
 *   - `scope`                     — a list of scope-tags defining WHERE the
 *                                    agent may act (e.g. `["tenant:acme",
 *                                    "team:ops"]`).
 *
 * The `BoundaryChecker` PORT is the policy evaluator: given an agent + an
 * action + a cost, return `{ allowed, requiresApproval, reason }`. The
 * default in-memory implementation lives in `infrastructure/`.
 *
 * Decision logic (encoded by `checkBoundaries` — the pure core used by the
 * default implementation AND available for direct use):
 *
 *   1. If `action` is in `forbiddenActions` → `{allowed: false, requiresApproval: false, reason: "forbidden action"}`.
 *   2. If `action` is NOT in `allowedActions` (and the whitelist is non-empty)
 *      → `{allowed: false, requiresApproval: true, reason: "action not in allow-list"}`.
 *   3. If `cost > maxDecisionCost` AND `cost > requiresApprovalAbove` →
 *      `{allowed: false, requiresApproval: true, reason: "cost exceeds both ceiling and approval threshold"}`.
 *   4. If `cost > maxDecisionCost` AND `cost <= requiresApprovalAbove` →
 *      `{allowed: false, requiresApproval: false, reason: "cost exceeds max decision cost (absolute ceiling)"}`.
 *   5. If `cost <= maxDecisionCost` AND `cost > requiresApprovalAbove` →
 *      `{allowed: true, requiresApproval: true, reason: "cost above approval threshold but within ceiling"}`.
 *      (The agent MAY proceed, but MUST request approval — the workflow
 *      implementation enforces this; the boundary check merely surfaces it.)
 *   6. Otherwise → `{allowed: true, requiresApproval: false, reason: "within boundaries"}`.
 *
 * Determinism rule: no `Date.now()` / `Math.random()`. `checkBoundaries` is a
 * pure function of `(boundaries, action, cost)`.
 *
 * Layering: domain depends ONLY on `@kernel/shared-kernel`.
 */
import {
  type KernelError,
  type Result,
  ValidationError,
  err,
  ok,
} from "@kernel/shared-kernel";

/**
 * The autonomous boundaries envelope. See file-level JSDoc.
 */
export interface AutonomousBoundaries {
  readonly maxDecisionCost: number;
  readonly requiresApprovalAbove: number;
  readonly allowedActions: readonly string[];
  readonly forbiddenActions: readonly string[];
  readonly maxAutonomousDurationMs: number;
  readonly escalationOnTimeout: boolean;
  readonly scope: readonly string[];
}

/**
 * The result of a boundary check. See file-level JSDoc.
 */
export interface BoundaryCheckResult {
  readonly allowed: boolean;
  readonly requiresApproval: boolean;
  readonly reason: string;
}

/**
 * The BoundaryChecker PORT. Pure: given an agent id + an action + a cost,
 * return a `BoundaryCheckResult`. Implementations look up the agent's
 * boundaries from the registry, then call `checkBoundaries`.
 */
export interface BoundaryChecker {
  check(agentId: string, action: string, cost: number): BoundaryCheckResult;
}

/**
 * Pure core boundary check. Encodes the decision logic in the file-level
 * JSDoc. Used by the default `BoundaryChecker` implementation AND available
 * for direct use by tests / protocols.
 *
 * Pure w.r.t. `(boundaries, action, cost)`.
 */
export function checkBoundaries(
  boundaries: AutonomousBoundaries,
  action: string,
  cost: number
): BoundaryCheckResult {
  // 1. Forbidden actions are absolute prohibitions — never allowed, never
  //    approval-able.
  if (boundaries.forbiddenActions.includes(action)) {
    return {
      allowed: false,
      requiresApproval: false,
      reason: `action '${action}' is forbidden`,
    };
  }

  // 2. If an allow-list is present and the action is not on it, the agent
  //    cannot perform it autonomously — but it MAY request approval (the
  //    workflow decides whether to grant).
  if (
    boundaries.allowedActions.length > 0 &&
    !boundaries.allowedActions.includes(action)
  ) {
    return {
      allowed: false,
      requiresApproval: true,
      reason: `action '${action}' is not in the allow-list`,
    };
  }

  const aboveCeiling = cost > boundaries.maxDecisionCost;
  const aboveApproval = cost > boundaries.requiresApprovalAbove;

  // 3. Above both ceiling and approval threshold → not allowed, requires
  //    approval. The approval workflow may cap the cost or reject.
  if (aboveCeiling && aboveApproval) {
    return {
      allowed: false,
      requiresApproval: true,
      reason:
        `cost ${cost} exceeds both max-decision-cost ${boundaries.maxDecisionCost} ` +
        `and approval threshold ${boundaries.requiresApprovalAbove}`,
    };
  }

  // 4. Above the absolute ceiling but at-or-below the approval threshold.
  //    This configuration is unusual (ceiling < approval threshold) but
  //    legal: the ceiling is an absolute prohibition — approval cannot
  //    override it.
  if (aboveCeiling && !aboveApproval) {
    return {
      allowed: false,
      requiresApproval: false,
      reason: `cost ${cost} exceeds absolute max-decision-cost ${boundaries.maxDecisionCost}`,
    };
  }

  // 5. At-or-below the ceiling but above the approval threshold: the agent
  //    MAY proceed, but MUST request approval first.
  if (!aboveCeiling && aboveApproval) {
    return {
      allowed: true,
      requiresApproval: true,
      reason:
        `cost ${cost} is within ceiling ${boundaries.maxDecisionCost} ` +
        `but above approval threshold ${boundaries.requiresApprovalAbove}`,
    };
  }

  // 6. Otherwise: fully autonomous.
  return {
    allowed: true,
    requiresApproval: false,
    reason: "within boundaries",
  };
}

/**
 * Pure structural validation of `AutonomousBoundaries`. Returns
 * `err(ValidationError)` with a `details[]` list on failure, `ok(undefined)`
 * on success.
 *
 * Checks: maxDecisionCost is a non-negative finite number, requiresApprovalAbove
 * is a non-negative finite number, allowedActions is an array, forbiddenActions
 * is an array, maxAutonomousDurationMs is a non-negative finite number,
 * escalationOnTimeout is a boolean, scope is an array. No action appears in
 * BOTH allowed and forbidden (a configuration error).
 */
export function validateBoundaries(
  boundaries: AutonomousBoundaries
): Result<void, KernelError> {
  const details: Array<{ field: string; reason: string }> = [];

  if (
    typeof boundaries.maxDecisionCost !== "number" ||
    !Number.isFinite(boundaries.maxDecisionCost) ||
    boundaries.maxDecisionCost < 0
  ) {
    details.push({
      field: "maxDecisionCost",
      reason: "must be a non-negative finite number",
    });
  }
  if (
    typeof boundaries.requiresApprovalAbove !== "number" ||
    !Number.isFinite(boundaries.requiresApprovalAbove) ||
    boundaries.requiresApprovalAbove < 0
  ) {
    details.push({
      field: "requiresApprovalAbove",
      reason: "must be a non-negative finite number",
    });
  }
  if (!Array.isArray(boundaries.allowedActions)) {
    details.push({ field: "allowedActions", reason: "must be an array" });
  }
  if (!Array.isArray(boundaries.forbiddenActions)) {
    details.push({ field: "forbiddenActions", reason: "must be an array" });
  }
  if (
    typeof boundaries.maxAutonomousDurationMs !== "number" ||
    !Number.isFinite(boundaries.maxAutonomousDurationMs) ||
    boundaries.maxAutonomousDurationMs < 0
  ) {
    details.push({
      field: "maxAutonomousDurationMs",
      reason: "must be a non-negative finite number",
    });
  }
  if (typeof boundaries.escalationOnTimeout !== "boolean") {
    details.push({
      field: "escalationOnTimeout",
      reason: "must be a boolean",
    });
  }
  if (!Array.isArray(boundaries.scope)) {
    details.push({ field: "scope", reason: "must be an array" });
  }

  // No action may be in BOTH allow and forbidden lists.
  if (
    Array.isArray(boundaries.allowedActions) &&
    Array.isArray(boundaries.forbiddenActions)
  ) {
    const forbiddenSet = new Set(boundaries.forbiddenActions);
    for (const a of boundaries.allowedActions) {
      if (forbiddenSet.has(a)) {
        details.push({
          field: "allowedActions",
          reason: `action '${a}' appears in both allowed and forbidden lists`,
        });
      }
    }
  }

  if (details.length > 0) {
    return err(new ValidationError("invalid autonomous boundaries", details));
  }
  return ok(undefined);
}

/**
 * Helper for constructing an `AutonomousBoundaries`. Pure: returns a fresh
 * object with arrays copied from the input.
 */
export function createBoundaries(input: {
  readonly maxDecisionCost: number;
  readonly requiresApprovalAbove: number;
  readonly allowedActions?: readonly string[];
  readonly forbiddenActions?: readonly string[];
  readonly maxAutonomousDurationMs: number;
  readonly escalationOnTimeout: boolean;
  readonly scope?: readonly string[];
}): AutonomousBoundaries {
  return {
    maxDecisionCost: input.maxDecisionCost,
    requiresApprovalAbove: input.requiresApprovalAbove,
    allowedActions: input.allowedActions
      ? Array.from(input.allowedActions)
      : [],
    forbiddenActions: input.forbiddenActions
      ? Array.from(input.forbiddenActions)
      : [],
    maxAutonomousDurationMs: input.maxAutonomousDurationMs,
    escalationOnTimeout: input.escalationOnTimeout,
    scope: input.scope ? Array.from(input.scope) : [],
  };
}

/**
 * Sensible default boundaries for a brand-new agent with no specific
 * configuration: no actions allowed, nothing forbidden, no autonomous
 * duration, no scope — the agent can do NOTHING autonomously and must
 * request approval for everything. Protocols configure real boundaries
 * via `createBoundaries` / the use-case.
 *
 * Pure: returns a fresh object.
 */
export const DEFAULT_BOUNDARIES: AutonomousBoundaries = Object.freeze({
  maxDecisionCost: 0,
  requiresApprovalAbove: 0,
  allowedActions: [],
  forbiddenActions: [],
  maxAutonomousDurationMs: 0,
  escalationOnTimeout: true,
  scope: [],
});
