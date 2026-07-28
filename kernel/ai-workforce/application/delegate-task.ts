/**
 * @kernel/ai-workforce/application/delegate-task — use-case: delegate a task
 * from one agent to another via a handoff.
 *
 * Flow:
 *   1. validate the from-agent exists + is registered + is `active` (a
 *      dormant / paused / terminated agent cannot delegate)
 *   2. validate the to-agent exists + is registered + is `active`
 *   3. validate both agents are in the same organization + tenant (cross-org
 *      delegation is forbidden by default — protocols may relax this)
 *   4. initiate the handoff via `CollaborationEngine.initiateHandoff`
 *      (status `initiated`)
 *   5. record the delegation in BOTH agents' memories:
 *      - from-agent: a `decision` entry ("I delegated task X to Y")
 *      - to-agent:   a `context` entry ("Agent X delegated task X to me")
 *   6. the to-agent auto-accepts the handoff via `acceptHandoff` (in this
 *      use-case, delegation is a director-level decision — the to-agent
 *      accepts automatically; protocols requiring manual acceptance use the
 *      engine directly)
 *
 * On validation failure returns `err(ValidationError)`. On success returns
 * `ok({ handoff })`.
 *
 * !!! ADR-0006 LOUD INVARIANT !!!
 * Delegation runs at orchestration time — OUTSIDE the deterministic core.
 *
 * Pure w.r.t. `(deps, input)`: no `Date.now()`, no `Math.random()`. All time
 * via `input.now`. The handoff id is minted by the engine (deterministic per
 * instance counter).
 */
import {
  type KernelError,
  type Result,
  ValidationError,
  err,
  ok,
} from "@kernel/shared-kernel";
import {
  type AgentHandoff,
  type AgentRegistry,
  type CollaborationEngine,
  type MemoryStore,
  createMemoryEntry,
} from "../domain";

/**
 * Dependencies injected by the caller.
 */
export interface DelegateTaskDeps {
  readonly registry: AgentRegistry;
  readonly collaboration: CollaborationEngine;
  readonly memoryStore: MemoryStore;
}

/**
 * Input to `delegateTask`. Pure data.
 */
export interface DelegateTaskInput {
  readonly fromAgentId: string;
  readonly toAgentId: string;
  readonly taskId: string;
  /** Opaque serializable context to transfer with the task. */
  readonly context: Readonly<Record<string, unknown>>;
  /** Human-readable reason for the delegation. */
  readonly reason: string;
  /** Caller-supplied epoch-millis. */
  readonly now: number;
  /**
   * If true (default), the to-agent auto-accepts the handoff. If false, the
   * handoff is left in the `initiated` state for manual acceptance.
   */
  readonly autoAccept?: boolean;
}

/**
 * Result of `delegateTask`. The initiated (and possibly accepted) handoff.
 */
export interface DelegateTaskResult {
  readonly handoff: AgentHandoff;
}

/**
 * Delegate a task from one agent to another via a handoff.
 *
 * See file-level JSDoc for the flow. Returns `err(ValidationError)` on
 * validation failure, `ok({ handoff })` on success.
 */
export function delegateTask(
  deps: DelegateTaskDeps,
  input: DelegateTaskInput
): Result<DelegateTaskResult, KernelError> {
  // 1. Validate the from-agent exists + is active.
  const fromAgent = deps.registry.get(input.fromAgentId);
  if (fromAgent === undefined) {
    return err(
      new ValidationError(
        `from-agent '${input.fromAgentId}' not registered`,
        [{ field: "fromAgentId", reason: "no such agent" }]
      )
    );
  }
  if (fromAgent.status !== "active") {
    return err(
      new ValidationError(
        `from-agent '${input.fromAgentId}' is in status '${fromAgent.status}' — must be 'active' to delegate`,
        [{ field: "fromAgentId", reason: "agent must be active" }]
      )
    );
  }

  // 2. Validate the to-agent exists + is active.
  const toAgent = deps.registry.get(input.toAgentId);
  if (toAgent === undefined) {
    return err(
      new ValidationError(
        `to-agent '${input.toAgentId}' not registered`,
        [{ field: "toAgentId", reason: "no such agent" }]
      )
    );
  }
  if (toAgent.status !== "active") {
    return err(
      new ValidationError(
        `to-agent '${input.toAgentId}' is in status '${toAgent.status}' — must be 'active' to receive delegation`,
        [{ field: "toAgentId", reason: "agent must be active" }]
      )
    );
  }

  // 3. Same-org / same-tenant check.
  if (fromAgent.organizationId !== toAgent.organizationId) {
    return err(
      new ValidationError(
        `cross-organization delegation forbidden: from-agent in '${fromAgent.organizationId}', to-agent in '${toAgent.organizationId}'`,
        [
          {
            field: "toAgentId",
            reason: "must be in the same organization as from-agent",
          },
        ]
      )
    );
  }
  if (fromAgent.tenantId !== toAgent.tenantId) {
    return err(
      new ValidationError(
        `cross-tenant delegation forbidden: from-agent in '${fromAgent.tenantId}', to-agent in '${toAgent.tenantId}'`,
        [
          {
            field: "toAgentId",
            reason: "must be in the same tenant as from-agent",
          },
        ]
      )
    );
  }

  // 4. Initiate the handoff.
  const initiated = deps.collaboration.initiateHandoff(
    input.fromAgentId,
    input.toAgentId,
    input.taskId,
    input.context,
    input.reason,
    input.now
  );

  // 5. Record in BOTH agents' memories.
  deps.memoryStore.record(
    input.fromAgentId,
    createMemoryEntry({
      id: `${initiated.id}#from-decision`,
      kind: "decision",
      content: `Delegated task '${input.taskId}' to agent '${input.toAgentId}'. Reason: ${input.reason}. Handoff id: ${initiated.id}.`,
      confidence: 1.0,
      now: input.now,
    })
  );
  deps.memoryStore.record(
    input.toAgentId,
    createMemoryEntry({
      id: `${initiated.id}#to-context`,
      kind: "context",
      content: `Received delegation of task '${input.taskId}' from agent '${input.fromAgentId}'. Reason: ${input.reason}. Handoff id: ${initiated.id}.`,
      confidence: 1.0,
      now: input.now,
    })
  );

  // 6. Auto-accept if requested (default true).
  const autoAccept = input.autoAccept !== false;
  const final = autoAccept
    ? deps.collaboration.acceptHandoff(initiated.id, input.now)
    : initiated;

  return ok({ handoff: final });
}

/**
 * Use-case class wrapping `delegateTask` with constructor-injected deps.
 */
export class DelegateTask {
  constructor(private readonly deps: DelegateTaskDeps) {}

  execute(input: DelegateTaskInput): Result<DelegateTaskResult, KernelError> {
    return delegateTask(this.deps, input);
  }
}
