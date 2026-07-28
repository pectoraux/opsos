/**
 * @kernel/ai-workforce/domain/agent-collaboration — AgentHandoff, AgentMessage,
 * AgentCollaboration, and the CollaborationEngine PORT.
 *
 * Agents collaborate by handing off tasks and sending messages. This file
 * defines the data structures and the engine port that orchestrates them.
 *
 *   - `AgentHandoff` — a formal transfer of a task from one agent to another.
 *                      Carries context + reason + status (initiated →
 *                      accepted | rejected → completed).
 *   - `AgentMessage` — a directed message between two agents (request /
 *                      response / inform / delegate / escalate).
 *   - `AgentCollaboration` — a per-pair (or per-team) collaboration record
 *                      aggregating handoffs, messages, and shared context.
 *   - `CollaborationEngine` PORT — the operations: `initiateHandoff`,
 *                      `acceptHandoff`, `sendMessage`, `getConversation`.
 *
 * Handoff lifecycle:
 *
 *      initiated ──accept──► accepted ──complete──► completed
 *      initiated ──reject──► rejected   (terminal)
 *      accepted  ──reject──► rejected   (terminal — agent bails after accepting)
 *      (rejected | completed) — terminal, no further transitions
 *
 * Message lifecycle is intentionally simpler: messages are SENT and then
 * transition through delivered → read. The engine tracks delivery status but
 * does NOT enforce transitions (impl-defined).
 *
 * Determinism rule: no `Date.now()` / `Math.random()`. All time via caller-
 * supplied `now`. The engine mints deterministic ids from a per-instance
 * counter + the inputs (so identical calls produce identical ids within a
 * session).
 *
 * Layering: domain depends ONLY on `@kernel/shared-kernel` (`IllegalStateError`
 * for illegal transitions, `ValidationError` for structural validation).
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
 * The status of an agent handoff. See file-level JSDoc.
 */
export type AgentHandoffStatus =
  | "initiated"
  | "accepted"
  | "rejected"
  | "completed";

/**
 * The kind of an agent message. See file-level JSDoc.
 */
export type AgentMessageKind =
  | "request"
  | "response"
  | "inform"
  | "delegate"
  | "escalate";

/**
 * The delivery status of an agent message.
 */
export type AgentMessageStatus = "sent" | "delivered" | "read";

/**
 * An immutable agent handoff. See file-level JSDoc.
 */
export interface AgentHandoff {
  readonly id: string;
  readonly fromAgentId: string;
  readonly toAgentId: string;
  /** The task id being handed off (references a Task / Demand / etc.). */
  readonly taskId: string;
  /** Opaque serializable context to transfer with the task. */
  readonly context: Readonly<Record<string, unknown>>;
  /** Human-readable reason for the handoff. */
  readonly reason: string;
  readonly status: AgentHandoffStatus;
  readonly timestamp: number;
}

/**
 * An immutable agent message. See file-level JSDoc.
 */
export interface AgentMessage {
  readonly id: string;
  readonly fromAgentId: string;
  readonly toAgentId: string;
  readonly kind: AgentMessageKind;
  readonly content: string;
  readonly timestamp: number;
  readonly status: AgentMessageStatus;
}

/**
 * A bag of shared context for a collaboration (typically per-team). Opaque
 * record so protocols can stash whatever they need.
 */
export interface SharedContext {
  readonly teamId?: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/**
 * A collaboration record aggregating handoffs, messages, and shared context.
 * Typically scoped to a pair (or team) of agents.
 */
export interface AgentCollaboration {
  readonly id: string;
  readonly handoffs: readonly AgentHandoff[];
  readonly messages: readonly AgentMessage[];
  readonly sharedContext: SharedContext;
}

/**
 * The CollaborationEngine PORT. Every method is pure w.r.t. the engine's
 * internal state. `now` is supplied by the caller.
 *
 *   - `initiateHandoff` — create a handoff in the `initiated` state
 *   - `acceptHandoff`   — transition an initiated handoff to `accepted`
 *   - `sendMessage`     — record a directed message
 *   - `getConversation` — return all messages between two agents (either
 *                          direction), in chronological order
 */
export interface CollaborationEngine {
  initiateHandoff(
    fromAgentId: string,
    toAgentId: string,
    taskId: string,
    context: Readonly<Record<string, unknown>>,
    reason: string,
    now: number
  ): AgentHandoff;

  acceptHandoff(handoffId: string, now: number): AgentHandoff;

  sendMessage(
    fromAgentId: string,
    toAgentId: string,
    kind: AgentMessageKind,
    content: string,
    now: number
  ): AgentMessage;

  getConversation(agentA: string, agentB: string): readonly AgentMessage[];
}

/**
 * The legal transition table for handoffs. See file-level JSDoc.
 */
export const LEGAL_HANDOFF_TRANSITIONS: Readonly<
  Record<AgentHandoffStatus, readonly AgentHandoffStatus[]>
> = Object.freeze({
  initiated: ["accepted", "rejected"],
  accepted: ["completed", "rejected"],
  rejected: [],
  completed: [],
});

/**
 * True iff transitioning a handoff from `from` to `to` is legal. Same-state
 * transitions are NOT legal.
 */
export function canTransitionHandoff(
  from: AgentHandoffStatus,
  to: AgentHandoffStatus
): boolean {
  if (from === to) return false;
  return LEGAL_HANDOFF_TRANSITIONS[from].includes(to);
}

/**
 * Apply a lifecycle transition to a handoff. Returns a fresh `AgentHandoff`
 * with the new `status` and `timestamp = now`. Throws `IllegalStateError` on
 * illegal transition. Pure w.r.t. `(handoff, to, now)`.
 */
export function transitionHandoff(
  handoff: AgentHandoff,
  to: AgentHandoffStatus,
  now: number
): AgentHandoff {
  if (!canTransitionHandoff(handoff.status, to)) {
    throw new IllegalStateError(
      `Handoff '${handoff.id}' cannot transition from '${handoff.status}' to '${to}'`
    );
  }
  return { ...handoff, status: to, timestamp: now };
}

/**
 * Pure structural validation of an `AgentHandoff`. Returns
 * `err(ValidationError)` with a `details[]` list on failure, `ok(undefined)`
 * on success.
 */
export function validateHandoff(
  handoff: AgentHandoff
): Result<void, KernelError> {
  const details: Array<{ field: string; reason: string }> = [];

  if (!handoff.id || handoff.id.trim() === "") {
    details.push({ field: "id", reason: "must be non-empty" });
  }
  if (!handoff.fromAgentId || handoff.fromAgentId.trim() === "") {
    details.push({ field: "fromAgentId", reason: "must be non-empty" });
  }
  if (!handoff.toAgentId || handoff.toAgentId.trim() === "") {
    details.push({ field: "toAgentId", reason: "must be non-empty" });
  }
  if (handoff.fromAgentId === handoff.toAgentId) {
    details.push({
      field: "toAgentId",
      reason: "must differ from fromAgentId",
    });
  }
  if (!handoff.taskId || handoff.taskId.trim() === "") {
    details.push({ field: "taskId", reason: "must be non-empty" });
  }
  if (!handoff.context || typeof handoff.context !== "object") {
    details.push({ field: "context", reason: "must be an object" });
  }
  if (handoff.reason === undefined || handoff.reason === null) {
    details.push({ field: "reason", reason: "must be present" });
  }
  const validStatuses: readonly AgentHandoffStatus[] = [
    "initiated",
    "accepted",
    "rejected",
    "completed",
  ];
  if (!validStatuses.includes(handoff.status)) {
    details.push({ field: "status", reason: `unknown status '${handoff.status}'` });
  }
  if (typeof handoff.timestamp !== "number" || handoff.timestamp < 0) {
    details.push({ field: "timestamp", reason: "must be a non-negative number" });
  }

  if (details.length > 0) {
    return err(new ValidationError("invalid agent handoff", details));
  }
  return ok(undefined);
}

/**
 * Pure structural validation of an `AgentMessage`. Returns
 * `err(ValidationError)` with a `details[]` list on failure, `ok(undefined)`
 * on success.
 */
export function validateMessage(
  message: AgentMessage
): Result<void, KernelError> {
  const details: Array<{ field: string; reason: string }> = [];

  if (!message.id || message.id.trim() === "") {
    details.push({ field: "id", reason: "must be non-empty" });
  }
  if (!message.fromAgentId || message.fromAgentId.trim() === "") {
    details.push({ field: "fromAgentId", reason: "must be non-empty" });
  }
  if (!message.toAgentId || message.toAgentId.trim() === "") {
    details.push({ field: "toAgentId", reason: "must be non-empty" });
  }
  if (message.fromAgentId === message.toAgentId) {
    details.push({
      field: "toAgentId",
      reason: "must differ from fromAgentId",
    });
  }
  const validKinds: readonly AgentMessageKind[] = [
    "request",
    "response",
    "inform",
    "delegate",
    "escalate",
  ];
  if (!validKinds.includes(message.kind)) {
    details.push({ field: "kind", reason: `unknown kind '${message.kind}'` });
  }
  if (message.content === undefined || message.content === null) {
    details.push({ field: "content", reason: "must be present" });
  }
  if (typeof message.timestamp !== "number" || message.timestamp < 0) {
    details.push({ field: "timestamp", reason: "must be a non-negative number" });
  }
  const validStatuses: readonly AgentMessageStatus[] = [
    "sent",
    "delivered",
    "read",
  ];
  if (!validStatuses.includes(message.status)) {
    details.push({ field: "status", reason: `unknown status '${message.status}'` });
  }

  if (details.length > 0) {
    return err(new ValidationError("invalid agent message", details));
  }
  return ok(undefined);
}
