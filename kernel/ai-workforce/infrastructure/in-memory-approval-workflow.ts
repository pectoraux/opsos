/**
 * @kernel/ai-workforce/infrastructure/in-memory-approval-workflow — the
 * reference `ApprovalWorkflow` implementation.
 *
 * Holds approval requests in a `Map<string, HumanApprovalRequest>` keyed by
 * id. Mints deterministic ids from a per-instance counter.
 *
 * Semantics:
 *   - `requestApproval` — mint a request in the `pending` state, store it,
 *     return it.
 *   - `approve` / `reject` / `expire` — transition `pending → approved |
 *     rejected | expired` via `transitionApproval` (throws `IllegalStateError`
 *     on illegal transition). `escalate` is NOT exposed on the port — it is
 *     an out-of-band operation performed by a director / human; the kernel
 *     only records the resulting `escalated` status (via direct transition
 *     if ever needed).
 *   - `listPending` — return all requests in the `pending` state, sorted by
 *     `requestedAt` ascending then id ascending. Fresh array each call.
 *
 * Determinism: no `Date.now()` / `Math.random()`. All time via caller-supplied
 * `now`. Ids are deterministic per instance counter (`approval-${counter}`).
 *
 * Suitable for kernel self-test, the read-only inspector, and tests. NOT for
 * production persistence (no durability, no notification / routing — the
 * workflow records requests but does NOT notify approvers; that is the job
 * of a higher-level notification layer).
 */
import { IllegalStateError } from "@kernel/shared-kernel";
import type {
  ApprovalRisk,
  ApprovalWorkflow,
  HumanApprovalRequest,
} from "../domain";
import { transitionApproval } from "../domain";

/**
 * Reference in-memory `ApprovalWorkflow`. See file-level JSDoc.
 */
export class InMemoryApprovalWorkflow implements ApprovalWorkflow {
  /** Requests keyed by id. */
  private readonly requests: Map<string, HumanApprovalRequest> = new Map();
  /** Per-instance counter for id minting. */
  private counter = 0;

  /** Mint a request in the `pending` state. */
  requestApproval(
    agentId: string,
    action: string,
    description: string,
    risk: ApprovalRisk,
    context: Readonly<Record<string, unknown>>,
    now: number
  ): HumanApprovalRequest {
    this.counter += 1;
    const id = `approval-${this.counter}`;
    const request: HumanApprovalRequest = {
      id,
      agentId,
      action,
      description,
      risk,
      context,
      status: "pending",
      requestedAt: now,
    };
    this.requests.set(id, request);
    return request;
  }

  /**
   * Transition request `requestId` from `pending` to `approved`. Returns the
   * updated request. Throws `IllegalStateError` if not found or not pending.
   */
  approve(
    requestId: string,
    decidedBy: string,
    now: number,
    reason?: string
  ): HumanApprovalRequest {
    return this.applyTransition(requestId, "approved", now, decidedBy, reason);
  }

  /**
   * Transition request `requestId` from `pending` to `rejected`. Returns the
   * updated request. Throws `IllegalStateError` if not found or not pending.
   */
  reject(
    requestId: string,
    decidedBy: string,
    now: number,
    reason?: string
  ): HumanApprovalRequest {
    return this.applyTransition(requestId, "rejected", now, decidedBy, reason);
  }

  /**
   * Transition request `requestId` from `pending` to `expired`. Returns the
   * updated request. Throws `IllegalStateError` if not found or not pending.
   * `decidedBy` is set to `"<system>"` since expiry is automatic.
   */
  expire(requestId: string, now: number): HumanApprovalRequest {
    return this.applyTransition(
      requestId,
      "expired",
      now,
      "<system>",
      "expired before decision"
    );
  }

  /**
   * Return all requests in the `pending` state, sorted by `requestedAt`
   * ascending then id ascending. Fresh array each call.
   */
  listPending(): readonly HumanApprovalRequest[] {
    return Array.from(this.requests.values())
      .filter((r) => r.status === "pending")
      .sort((a, b) => {
        if (a.requestedAt !== b.requestedAt) {
          return a.requestedAt - b.requestedAt;
        }
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
  }

  // ── Internal ───────────────────────────────────────────────────────────

  /**
   * Apply a transition to a request. Internal helper used by `approve` /
   * `reject` / `expire`.
   */
  private applyTransition(
    requestId: string,
    to: "approved" | "rejected" | "expired",
    now: number,
    decidedBy: string,
    reason?: string
  ): HumanApprovalRequest {
    const current = this.requests.get(requestId);
    if (current === undefined) {
      throw new IllegalStateError(
        `approval request '${requestId}' not found`
      );
    }
    let next: HumanApprovalRequest;
    try {
      next = transitionApproval(current, to, now, decidedBy, reason);
    } catch (e) {
      if (e instanceof IllegalStateError) throw e;
      throw new IllegalStateError(
        `approval request '${requestId}' failed to transition to '${to}': ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
    this.requests.set(requestId, next);
    return next;
  }

  // ── Introspection helpers (NOT part of the ApprovalWorkflow port) ───────

  /** Get a request by id. For tests / diagnostics. */
  get(requestId: string): HumanApprovalRequest | undefined {
    return this.requests.get(requestId);
  }

  /** All requests, in insertion order. For tests / diagnostics. */
  listAll(): readonly HumanApprovalRequest[] {
    return Array.from(this.requests.values());
  }

  /** Remove all requests. For tests / diagnostics. */
  clear(): void {
    this.requests.clear();
    this.counter = 0;
  }
}
