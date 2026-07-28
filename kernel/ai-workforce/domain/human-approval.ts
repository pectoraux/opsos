/**
 * @kernel/ai-workforce/domain/human-approval — HumanApprovalRequest + the
 * ApprovalWorkflow PORT.
 *
 * When an agent's autonomous boundaries are exceeded (cost too high, action
 * forbidden, duration too long, scope out of bounds), the agent requests
 * HUMAN APPROVAL before proceeding. This is the human-in-the-loop gate that
 * keeps autonomous AI accountable.
 *
 * `HumanApprovalRequest` is the immutable record of one such request:
 *   - which agent asked (`agentId`)
 *   - what action it wanted to take (`action`)
 *   - a human-readable description
 *   - the risk level (`low` | `medium` | `high` | `critical`)
 *   - opaque context (action params, predicted impact, etc.)
 *   - status (`pending` | `approved` | `rejected` | `expired` | `escalated`)
 *   - timestamps + decidedBy + reason
 *
 * Request lifecycle:
 *
 *      pending ──approve──► approved   (terminal — agent may proceed)
 *      pending ──reject────► rejected  (terminal — agent must NOT proceed)
 *      pending ──expire────► expired   (terminal — agent re-requests or escalates)
 *      pending ──escalate──► escalated (terminal — bumped to a human director
 *                                       or a higher authority; out-of-band)
 *
 * All terminal states are immutable. The kernel does NOT decide who the
 * approver is — `decidedBy` is the principal id supplied by the caller (the
 * approval workflow implementation routes to the right human / role).
 *
 * The `ApprovalWorkflow` PORT is the operations surface:
 *   - `requestApproval` — create a pending request
 *   - `approve`         — transition pending → approved
 *   - `reject`          — transition pending → rejected
 *   - `expire`          — transition pending → expired
 *   - `listPending`     — return all pending requests (for human review UIs)
 *
 * Determinism rule: no `Date.now()` / `Math.random()`. All time via caller-
 * supplied `now`. The workflow mints deterministic ids from a per-instance
 * counter + inputs.
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
 * The risk level of an approval request. See file-level JSDoc.
 */
export type ApprovalRisk = "low" | "medium" | "high" | "critical";

/**
 * The status of an approval request. See file-level JSDoc.
 */
export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "escalated";

/**
 * An immutable human approval request. See file-level JSDoc.
 */
export interface HumanApprovalRequest {
  readonly id: string;
  readonly agentId: string;
  /** The action the agent wants to take (e.g. `"resource.delete"`). */
  readonly action: string;
  readonly description: string;
  readonly risk: ApprovalRisk;
  /** Opaque serializable context (action params, predicted impact, etc.). */
  readonly context: Readonly<Record<string, unknown>>;
  readonly status: ApprovalStatus;
  readonly requestedAt: number;
  /** Present iff `status` is terminal. */
  readonly decidedAt?: number;
  /** Principal id of the approver / escalator. Present iff terminal. */
  readonly decidedBy?: string;
  /** Optional reason for the decision. */
  readonly reason?: string;
}

/**
 * The ApprovalWorkflow PORT. Every method is pure w.r.t. the workflow's
 * internal state. `now` is supplied by the caller. See file-level JSDoc.
 */
export interface ApprovalWorkflow {
  requestApproval(
    agentId: string,
    action: string,
    description: string,
    risk: ApprovalRisk,
    context: Readonly<Record<string, unknown>>,
    now: number
  ): HumanApprovalRequest;

  approve(
    requestId: string,
    decidedBy: string,
    now: number,
    reason?: string
  ): HumanApprovalRequest;

  reject(
    requestId: string,
    decidedBy: string,
    now: number,
    reason?: string
  ): HumanApprovalRequest;

  expire(requestId: string, now: number): HumanApprovalRequest;

  listPending(): readonly HumanApprovalRequest[];
}

/**
 * The legal transition table for approval requests. See file-level JSDoc.
 *
 * Only `pending` has outgoing transitions. Terminal states (`approved`,
 * `rejected`, `expired`, `escalated`) are immutable.
 */
export const LEGAL_APPROVAL_TRANSITIONS: Readonly<
  Record<ApprovalStatus, readonly ApprovalStatus[]>
> = Object.freeze({
  pending: ["approved", "rejected", "expired", "escalated"],
  approved: [],
  rejected: [],
  expired: [],
  escalated: [],
});

/**
 * True iff transitioning a request from `from` to `to` is legal. Same-state
 * transitions are NOT legal.
 */
export function canTransitionApproval(
  from: ApprovalStatus,
  to: ApprovalStatus
): boolean {
  if (from === to) return false;
  return LEGAL_APPROVAL_TRANSITIONS[from].includes(to);
}

/**
 * Apply a lifecycle transition to an approval request. Returns a fresh
 * `HumanApprovalRequest` with the new `status`, `decidedAt = now`, and
 * `decidedBy` / `reason` set if supplied. Throws `IllegalStateError` on
 * illegal transition. Pure w.r.t. `(request, to, now, decidedBy?, reason?)`.
 */
export function transitionApproval(
  request: HumanApprovalRequest,
  to: ApprovalStatus,
  now: number,
  decidedBy?: string,
  reason?: string
): HumanApprovalRequest {
  if (!canTransitionApproval(request.status, to)) {
    throw new IllegalStateError(
      `Approval '${request.id}' cannot transition from '${request.status}' to '${to}'`
    );
  }
  const next: HumanApprovalRequest = {
    ...request,
    status: to,
    decidedAt: now,
  };
  if (decidedBy !== undefined) {
    (next as { decidedBy?: string }).decidedBy = decidedBy;
  }
  if (reason !== undefined) {
    (next as { reason?: string }).reason = reason;
  }
  return next;
}

/**
 * Pure structural validation of a `HumanApprovalRequest`. Returns
 * `err(ValidationError)` with a `details[]` list on failure, `ok(undefined)`
 * on success.
 */
export function validateApprovalRequest(
  request: HumanApprovalRequest
): Result<void, KernelError> {
  const details: Array<{ field: string; reason: string }> = [];

  if (!request.id || request.id.trim() === "") {
    details.push({ field: "id", reason: "must be non-empty" });
  }
  if (!request.agentId || request.agentId.trim() === "") {
    details.push({ field: "agentId", reason: "must be non-empty" });
  }
  if (!request.action || request.action.trim() === "") {
    details.push({ field: "action", reason: "must be non-empty" });
  }
  if (request.description === undefined || request.description === null) {
    details.push({ field: "description", reason: "must be present" });
  }
  const validRisks: readonly ApprovalRisk[] = [
    "low",
    "medium",
    "high",
    "critical",
  ];
  if (!validRisks.includes(request.risk)) {
    details.push({ field: "risk", reason: `unknown risk '${request.risk}'` });
  }
  if (!request.context || typeof request.context !== "object") {
    details.push({ field: "context", reason: "must be an object" });
  }
  const validStatuses: readonly ApprovalStatus[] = [
    "pending",
    "approved",
    "rejected",
    "expired",
    "escalated",
  ];
  if (!validStatuses.includes(request.status)) {
    details.push({ field: "status", reason: `unknown status '${request.status}'` });
  }
  if (
    typeof request.requestedAt !== "number" ||
    request.requestedAt < 0
  ) {
    details.push({
      field: "requestedAt",
      reason: "must be a non-negative number",
    });
  }
  if (
    request.decidedAt !== undefined &&
    (typeof request.decidedAt !== "number" || request.decidedAt < 0)
  ) {
    details.push({
      field: "decidedAt",
      reason: "must be a non-negative number if present",
    });
  }
  // If status is terminal, decidedAt and decidedBy SHOULD be present.
  if (
    request.status !== "pending" &&
    (request.decidedAt === undefined || request.decidedBy === undefined)
  ) {
    details.push({
      field: "decidedAt",
      reason: "terminal status requires decidedAt + decidedBy",
    });
  }

  if (details.length > 0) {
    return err(new ValidationError("invalid approval request", details));
  }
  return ok(undefined);
}
