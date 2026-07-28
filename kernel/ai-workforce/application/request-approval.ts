/**
 * @kernel/ai-workforce/application/request-approval — use-case: an agent
 * requests human approval for an action.
 *
 * Flow:
 *   1. validate the agent exists + is registered + is `active`
 *   2. (optionally) check boundaries: if the action is forbidden, return
 *      `err(ValidationError)` — forbidden actions cannot be approved; if the
 *      action is fully within boundaries, return `ok({ request, skipped: true })`
 *      — the agent does not need approval (the caller may proceed without
 *      requesting). If `forceRequest` is true, the request is created
 *      regardless.
 *   3. create the approval request via `ApprovalWorkflow.requestApproval`
 *   4. record the request in the agent's memory as a `decision` entry
 *
 * On validation failure returns `err(ValidationError)`. On success returns
 * `ok({ request, skipped? })`. `skipped: true` indicates the boundary check
 * found the action does NOT require approval (the caller MAY proceed without
 * requesting; the request was NOT created).
 *
 * !!! ADR-0006 LOUD INVARIANT !!!
 * Approval requests run at orchestration time — OUTSIDE the deterministic
 * core. The approval DECISION (approve / reject) is made by a human (or a
 * human-delegated role) — never by the kernel.
 *
 * Pure w.r.t. `(deps, input)`: no `Date.now()`, no `Math.random()`. All time
 * via `input.now`. The request id is minted by the workflow (deterministic
 * per instance counter).
 */
import {
  type KernelError,
  type Result,
  ValidationError,
  err,
  ok,
} from "@kernel/shared-kernel";
import {
  type AgentRegistry,
  type ApprovalRisk,
  type ApprovalWorkflow,
  type BoundaryChecker,
  type HumanApprovalRequest,
  type MemoryStore,
  createMemoryEntry,
} from "../domain";

/**
 * Dependencies injected by the caller.
 */
export interface RequestApprovalDeps {
  readonly registry: AgentRegistry;
  readonly approval: ApprovalWorkflow;
  readonly memoryStore: MemoryStore;
  /**
   * Optional boundary checker. If supplied AND `input.checkBoundaries` is
   * true (default), the use-case consults it to decide whether the request
   * is needed (and to refuse forbidden actions).
   */
  readonly boundaryChecker?: BoundaryChecker;
}

/**
 * Input to `requestApproval`. Pure data.
 */
export interface RequestApprovalInput {
  readonly agentId: string;
  readonly action: string;
  readonly description: string;
  readonly risk: ApprovalRisk;
  readonly context: Readonly<Record<string, unknown>>;
  /**
   * The cost of the action (used by the boundary checker to decide if
   * approval is needed). Default 0.
   */
  readonly cost?: number;
  /**
   * If true (default), consult the boundary checker. If false, skip the
   * boundary check and always create the request.
   */
  readonly checkBoundaries?: boolean;
  /**
   * If true, create the request even if the boundary check says it isn't
   * needed. Default false (skip the request when not needed).
   */
  readonly forceRequest?: boolean;
  /** Caller-supplied epoch-millis. */
  readonly now: number;
}

/**
 * Result of `requestApproval`. The created request (or `undefined` if
 * `skipped: true`).
 */
export interface RequestApprovalResult {
  readonly request?: HumanApprovalRequest;
  /**
   * True iff the boundary check found the action does NOT require approval
   * and `forceRequest` was false. In that case, `request` is undefined and
   * the caller MAY proceed without requesting.
   */
  readonly skipped: boolean;
}

/**
 * An agent requests human approval for an action.
 *
 * See file-level JSDoc for the flow. Returns `err(ValidationError)` on
 * validation failure, `ok({ request?, skipped })` on success.
 */
export function requestApproval(
  deps: RequestApprovalDeps,
  input: RequestApprovalInput
): Result<RequestApprovalResult, KernelError> {
  // 1. Validate the agent exists + is active.
  const agent = deps.registry.get(input.agentId);
  if (agent === undefined) {
    return err(
      new ValidationError(`agent '${input.agentId}' not registered`, [
        { field: "agentId", reason: "no such agent" },
      ])
    );
  }
  if (agent.status !== "active") {
    return err(
      new ValidationError(
        `agent '${input.agentId}' is in status '${agent.status}' — must be 'active' to request approval`,
        [{ field: "agentId", reason: "agent must be active" }]
      )
    );
  }

  // 2. (Optionally) check boundaries.
  const checkBoundaries = input.checkBoundaries !== false;
  if (checkBoundaries && deps.boundaryChecker !== undefined) {
    const check = deps.boundaryChecker.check(
      input.agentId,
      input.action,
      input.cost ?? 0
    );
    // Forbidden actions cannot be approved — hard fail.
    if (!check.allowed && !check.requiresApproval) {
      return err(
        new ValidationError(
          `agent '${input.agentId}' cannot request approval for action '${input.action}': ${check.reason}`,
          [{ field: "action", reason: check.reason }]
        )
      );
    }
    // If the action is fully within boundaries (no approval required), skip
    // the request unless the caller forces it.
    if (check.allowed && !check.requiresApproval && !input.forceRequest) {
      return ok({ skipped: true });
    }
  }

  // 3. Create the approval request.
  const request = deps.approval.requestApproval(
    input.agentId,
    input.action,
    input.description,
    input.risk,
    input.context,
    input.now
  );

  // 4. Record in the agent's memory.
  deps.memoryStore.record(
    input.agentId,
    createMemoryEntry({
      id: `${request.id}#approval-request`,
      kind: "decision",
      content: `Requested approval for action '${input.action}' (risk: ${input.risk}). Request id: ${request.id}. Description: ${input.description}.`,
      confidence: 1.0,
      now: input.now,
    })
  );

  return ok({ request, skipped: false });
}

/**
 * Use-case class wrapping `requestApproval` with constructor-injected deps.
 */
export class RequestApproval {
  constructor(private readonly deps: RequestApprovalDeps) {}

  execute(
    input: RequestApprovalInput
  ): Result<RequestApprovalResult, KernelError> {
    return requestApproval(this.deps, input);
  }
}
