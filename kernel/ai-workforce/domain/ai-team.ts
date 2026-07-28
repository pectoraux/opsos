/**
 * @kernel/ai-workforce/domain/ai-team — the AITeam value object.
 *
 * An `AITeam` is a group of AI agents working together on a set of shared
 * objectives under one director. A team has exactly one `directorId` (an
 * `AIAgent` id, typically with the `role:director` role) and zero or more
 * `memberIds` (other agents — specialists, reviewers, executors).
 *
 * Teams are the unit of collaboration: handoffs happen between team members,
 * shared context lives at the team level, and the director is the escalation
 * target when a member's boundaries are exceeded.
 *
 * Team lifecycle:
 *
 *      forming ──activate──► active
 *      active  ──restructure──► restructuring ──activate──► active
 *      (forming | active | restructuring) ──dissolve──► dissolved
 *
 * `dissolved` is terminal.
 *
 * Determinism rule: no `Date.now()` / `Math.random()`. All time via caller-
 * supplied `now`. `AITeam` is pure data; helpers are pure functions.
 *
 * Layering: domain depends ONLY on `@kernel/shared-kernel`.
 */
import {
  type KernelError,
  type Result,
  IllegalStateError,
  ValidationError,
  err,
  ok,
} from "@kernel/shared-kernel";

/**
 * The status of an AI team.
 *
 *   - `forming`        — being assembled; not yet active.
 *   - `active`         — currently working together.
 *   - `restructuring`  — membership / objectives being changed; briefly inactive.
 *   - `dissolved`      — permanently disbanded. Terminal.
 */
export type AITeamStatus =
  | "forming"
  | "active"
  | "restructuring"
  | "dissolved";

/**
 * The immutable AITeam value object. See file-level JSDoc.
 */
export interface AITeam {
  readonly id: string;
  readonly name: string;
  readonly organizationId: string;
  readonly tenantId: string;
  /** The agent id of the team's director (typically role:director). */
  readonly directorId: string;
  /** Agent ids of the team's non-director members. */
  readonly memberIds: readonly string[];
  /** Shared objectives the team is working toward (free-form strings). */
  readonly objectives: readonly string[];
  readonly status: AITeamStatus;
  readonly createdAt: number;
}

/**
 * The legal transition table: `from → set(to)`.
 *
 *   forming        → {active, dissolved}
 *   active         → {restructuring, dissolved}
 *   restructuring  → {active, dissolved}
 *   dissolved      → {}  (terminal)
 */
export const LEGAL_TEAM_TRANSITIONS: Readonly<
  Record<AITeamStatus, readonly AITeamStatus[]>
> = Object.freeze({
  forming: ["active", "dissolved"],
  active: ["restructuring", "dissolved"],
  restructuring: ["active", "dissolved"],
  dissolved: [],
});

/**
 * True iff transitioning a team from `from` to `to` is legal. Same-state
 * transitions are NOT legal.
 */
export function canTransitionTeam(
  from: AITeamStatus,
  to: AITeamStatus
): boolean {
  if (from === to) return false;
  return LEGAL_TEAM_TRANSITIONS[from].includes(to);
}

/**
 * Apply a lifecycle transition to a team. Returns a fresh `AITeam` with the
 * new `status`. Throws `IllegalStateError` on illegal transition. Pure w.r.t.
 * `(team, to)`.
 */
export function transitionTeam(team: AITeam, to: AITeamStatus): AITeam {
  if (!canTransitionTeam(team.status, to)) {
    throw new IllegalStateError(
      `Team '${team.id}' cannot transition from '${team.status}' to '${to}'`
    );
  }
  return { ...team, status: to };
}

/**
 * Pure structural validation of an `AITeam`. Returns
 * `err(ValidationError)` with a `details[]` list on failure, `ok(undefined)`
 * on success.
 *
 * Checks: id non-empty, name non-empty, organizationId non-empty, tenantId
 * non-empty, directorId non-empty, memberIds is an array, objectives is an
 * array, status is a known team status, createdAt is a non-negative number.
 */
export function validateTeam(team: AITeam): Result<void, KernelError> {
  const details: Array<{ field: string; reason: string }> = [];

  if (!team.id || team.id.trim() === "") {
    details.push({ field: "id", reason: "must be non-empty" });
  }
  if (!team.name || team.name.trim() === "") {
    details.push({ field: "name", reason: "must be non-empty" });
  }
  if (!team.organizationId || team.organizationId.trim() === "") {
    details.push({ field: "organizationId", reason: "must be non-empty" });
  }
  if (!team.tenantId || team.tenantId.trim() === "") {
    details.push({ field: "tenantId", reason: "must be non-empty" });
  }
  if (!team.directorId || team.directorId.trim() === "") {
    details.push({ field: "directorId", reason: "must be non-empty" });
  }
  if (!Array.isArray(team.memberIds)) {
    details.push({ field: "memberIds", reason: "must be an array" });
  }
  if (!Array.isArray(team.objectives)) {
    details.push({ field: "objectives", reason: "must be an array" });
  }
  const validStatuses: readonly AITeamStatus[] = [
    "forming",
    "active",
    "restructuring",
    "dissolved",
  ];
  if (!validStatuses.includes(team.status)) {
    details.push({ field: "status", reason: `unknown status '${team.status}'` });
  }
  if (typeof team.createdAt !== "number" || team.createdAt < 0) {
    details.push({ field: "createdAt", reason: "must be a non-negative number" });
  }

  if (details.length > 0) {
    return err(new ValidationError("invalid AI team", details));
  }
  return ok(undefined);
}

/**
 * Helper for constructing a team in the `forming` initial state. The director
 * is required; members may be empty (the team is forming). Pure.
 */
export function createFormingTeam(input: {
  readonly id: string;
  readonly name: string;
  readonly organizationId: string;
  readonly tenantId: string;
  readonly directorId: string;
  readonly memberIds?: readonly string[];
  readonly objectives?: readonly string[];
  readonly now: number;
}): AITeam {
  return {
    id: input.id,
    name: input.name,
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    directorId: input.directorId,
    memberIds: input.memberIds ? Array.from(input.memberIds) : [],
    objectives: input.objectives ? Array.from(input.objectives) : [],
    status: "forming",
    createdAt: input.now,
  };
}
