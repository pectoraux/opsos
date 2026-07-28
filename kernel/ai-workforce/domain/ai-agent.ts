/**
 * @kernel/ai-workforce/domain/ai-agent — the AIAgent entity.
 *
 * An `AIAgent` is a single AI worker inside an AI Workforce. It carries:
 *   - identity (id, name, organizationId, tenantId)
 *   - a role (`roleId` references an `AIRole` defining permissions + decision
 *     authority + escalation threshold)
 *   - a lifecycle state (dormant → active → paused → terminated)
 *   - capabilities (a readonly string[] — what this agent CAN do)
 *   - autonomous boundaries (the cost / scope / action envelope inside which
 *     the agent may act without human approval)
 *   - a memory id (references an `AgentMemory` of observations, decisions,
 *     lessons, context, and goals)
 *   - timestamps (createdAt, updatedAt — caller-supplied epoch-millis)
 *
 * Lifecycle transitions (encoded by `LEGAL_AGENT_TRANSITIONS`):
 *
 *      dormant ──activate──► active
 *      active  ──pause─────► paused
 *      paused  ──resume─────► active
 *      active  ──pause─────► paused
 *      (dormant | active | paused) ──terminate──► terminated
 *
 * `terminated` is terminal. `dormant` cannot directly become `paused`. The
 * `canTransition` / `transition` helpers enforce the table.
 *
 * Determinism rule: NO `Date.now()` / `Math.random()`. All time flows through
 * the caller-supplied `now` argument. The agent is pure data; the helpers are
 * pure functions. `AIAgent` itself is an immutable interface — `transition`
 * returns a fresh object.
 *
 * Layering: domain depends ONLY on `@kernel/shared-kernel` (`IllegalStateError`
 * for illegal transitions, `ValidationError` for structural validation,
 * `Result`/`KernelError`). It imports the `AutonomousBoundaries` contract from
 * the sibling `autonomous-boundaries.ts` (same bounded context).
 */
import {
  type KernelError,
  type Result,
  IllegalStateError,
  ValidationError,
  err,
  ok,
} from "@kernel/shared-kernel";
import type { AutonomousBoundaries } from "./autonomous-boundaries";

/**
 * The lifecycle state of an AI agent.
 *
 *   - `dormant`    — created but not yet running. The default initial state.
 *   - `active`     — currently executing / ready to execute.
 *   - `paused`     — temporarily suspended; can be resumed.
 *   - `terminated` — permanently stopped. Terminal.
 */
export type AgentLifecycleState =
  | "dormant"
  | "active"
  | "paused"
  | "terminated";

/**
 * The immutable AIAgent entity. See file-level JSDoc.
 */
export interface AIAgent {
  readonly id: string;
  readonly name: string;
  /** The role id (references an `AIRole`). */
  readonly roleId: string;
  readonly organizationId: string;
  readonly tenantId: string;
  readonly status: AgentLifecycleState;
  /** What this agent CAN do (capability-type strings). */
  readonly capabilities: readonly string[];
  /** The cost / scope / action envelope for autonomous action. */
  readonly boundaries: AutonomousBoundaries;
  /** The memory id (references an `AgentMemory`). */
  readonly memoryId: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/**
 * The legal transition table: `from → set(to)`.
 *
 *   dormant    → {active, terminated}
 *   active     → {paused, terminated}
 *   paused     → {active, terminated}
 *   terminated → {}  (terminal)
 */
export const LEGAL_AGENT_TRANSITIONS: Readonly<
  Record<AgentLifecycleState, readonly AgentLifecycleState[]>
> = Object.freeze({
  dormant: ["active", "terminated"],
  active: ["paused", "terminated"],
  paused: ["active", "terminated"],
  terminated: [],
});

/**
 * True iff transitioning an agent from `from` to `to` is legal per
 * `LEGAL_AGENT_TRANSITIONS`. Same-state transitions are NOT legal (a no-op
 * must be rejected so callers see the state didn't change).
 */
export function canTransition(
  from: AgentLifecycleState,
  to: AgentLifecycleState
): boolean {
  if (from === to) return false;
  return LEGAL_AGENT_TRANSITIONS[from].includes(to);
}

/**
 * Apply a lifecycle transition to an agent. Returns a fresh `AIAgent` with the
 * new `status` and `updatedAt = now`. Throws `IllegalStateError` if the
 * transition is not in `LEGAL_AGENT_TRANSITIONS` (or if `from === to`).
 *
 * Pure w.r.t. `(agent, to, now)`.
 */
export function transition(
  agent: AIAgent,
  to: AgentLifecycleState,
  now: number
): AIAgent {
  if (!canTransition(agent.status, to)) {
    throw new IllegalStateError(
      `Agent '${agent.id}' cannot transition from '${agent.status}' to '${to}'`
    );
  }
  return { ...agent, status: to, updatedAt: now };
}

/**
 * Pure structural validation of a candidate `AIAgent`. Returns
 * `err(ValidationError)` with a `details[]` list on failure, `ok(undefined)`
 * on success.
 *
 * Checks: id non-empty, name non-empty, roleId non-empty, organizationId
 * non-empty, tenantId non-empty, status is a known lifecycle state,
 * memoryId non-empty, createdAt <= updatedAt, boundaries present, and
 * `capabilities` is an array.
 */
export function validateAgent(agent: AIAgent): Result<void, KernelError> {
  const details: Array<{ field: string; reason: string }> = [];

  if (!agent.id || agent.id.trim() === "") {
    details.push({ field: "id", reason: "must be non-empty" });
  }
  if (!agent.name || agent.name.trim() === "") {
    details.push({ field: "name", reason: "must be non-empty" });
  }
  if (!agent.roleId || agent.roleId.trim() === "") {
    details.push({ field: "roleId", reason: "must be non-empty" });
  }
  if (!agent.organizationId || agent.organizationId.trim() === "") {
    details.push({ field: "organizationId", reason: "must be non-empty" });
  }
  if (!agent.tenantId || agent.tenantId.trim() === "") {
    details.push({ field: "tenantId", reason: "must be non-empty" });
  }
  const validStates: readonly AgentLifecycleState[] = [
    "dormant",
    "active",
    "paused",
    "terminated",
  ];
  if (!validStates.includes(agent.status)) {
    details.push({ field: "status", reason: `unknown state '${agent.status}'` });
  }
  if (!agent.memoryId || agent.memoryId.trim() === "") {
    details.push({ field: "memoryId", reason: "must be non-empty" });
  }
  if (!Array.isArray(agent.capabilities)) {
    details.push({ field: "capabilities", reason: "must be an array" });
  }
  if (!agent.boundaries || typeof agent.boundaries !== "object") {
    details.push({ field: "boundaries", reason: "must be present" });
  } else {
    if (
      typeof agent.boundaries.maxDecisionCost !== "number" ||
      agent.boundaries.maxDecisionCost < 0
    ) {
      details.push({
        field: "boundaries.maxDecisionCost",
        reason: "must be a non-negative number",
      });
    }
    if (
      typeof agent.boundaries.requiresApprovalAbove !== "number" ||
      agent.boundaries.requiresApprovalAbove < 0
    ) {
      details.push({
        field: "boundaries.requiresApprovalAbove",
        reason: "must be a non-negative number",
      });
    }
    if (
      typeof agent.boundaries.maxAutonomousDurationMs !== "number" ||
      agent.boundaries.maxAutonomousDurationMs < 0
    ) {
      details.push({
        field: "boundaries.maxAutonomousDurationMs",
        reason: "must be a non-negative number",
      });
    }
  }
  if (typeof agent.createdAt !== "number" || agent.createdAt < 0) {
    details.push({ field: "createdAt", reason: "must be a non-negative number" });
  }
  if (typeof agent.updatedAt !== "number" || agent.updatedAt < 0) {
    details.push({ field: "updatedAt", reason: "must be a non-negative number" });
  }
  if (
    typeof agent.createdAt === "number" &&
    typeof agent.updatedAt === "number" &&
    agent.createdAt > agent.updatedAt
  ) {
    details.push({
      field: "updatedAt",
      reason: "must be >= createdAt",
    });
  }

  if (details.length > 0) {
    return err(new ValidationError("invalid AI agent", details));
  }
  return ok(undefined);
}

/**
 * Helper for constructing an agent in the `dormant` initial state. The caller
 * supplies `now` so `createdAt === updatedAt === now`. Pure: returns a fresh
 * object, never mutates inputs.
 */
export function createDormantAgent(input: {
  readonly id: string;
  readonly name: string;
  readonly roleId: string;
  readonly organizationId: string;
  readonly tenantId: string;
  readonly capabilities?: readonly string[];
  readonly boundaries: AutonomousBoundaries;
  readonly memoryId: string;
  readonly now: number;
}): AIAgent {
  return {
    id: input.id,
    name: input.name,
    roleId: input.roleId,
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    status: "dormant",
    capabilities: input.capabilities ? Array.from(input.capabilities) : [],
    boundaries: input.boundaries,
    memoryId: input.memoryId,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export { IllegalStateError, ValidationError };
