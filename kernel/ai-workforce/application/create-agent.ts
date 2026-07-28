/**
 * @kernel/ai-workforce/application/create-agent — use-case: create an AI agent
 * with a role + boundaries + memory.
 *
 * Flow:
 *   1. validate the role (predefined or already-registered custom role)
 *   2. validate the boundaries (pure structural check)
 *   3. construct a fresh `AgentMemory` for the agent (via `MemoryStore`)
 *   4. construct a dormant `AIAgent` (via `createDormantAgent`)
 *   5. validate the agent (pure structural check)
 *   6. register the agent (via `AgentRegistry`)
 *   7. seed the agent's memory with a `context` entry recording its role +
 *      boundaries (so the agent remembers what it is)
 *
 * On validation failure returns `err(ValidationError)`. On success returns
 * `ok({ agent, memoryId })`.
 *
 * !!! ADR-0006 LOUD INVARIANT !!!
 * `register` is the ONLY mutation surface and runs at BOOT / protocol-install
 * / orchestration time — OUTSIDE the deterministic core. The deterministic
 * core only READS the registry.
 *
 * Pure w.r.t. `(deps, input)`: no `Date.now()`, no `Math.random()`. All time
 * via `input.now`. All id minting is the caller's responsibility (the use-case
 * does NOT generate ids — `agentId` and `memoryId` are supplied in the input
 * so callers can use seeded `RandomSource` for deterministic ids).
 */
import {
  type KernelError,
  type Result,
  ValidationError,
  err,
  ok,
} from "@kernel/shared-kernel";
import {
  type AIAgent,
  type AIRole,
  type AgentRegistry,
  type AutonomousBoundaries,
  type MemoryStore,
  createDormantAgent,
  createMemoryEntry,
  validateAgent,
  validateBoundaries,
  validateRole,
} from "../domain";

/**
 * Dependencies injected by the caller. Pure ports — no I/O of their own.
 */
export interface CreateAgentDeps {
  readonly registry: AgentRegistry;
  readonly memoryStore: MemoryStore;
  /**
   * Look up a role by id. Returns the role or `undefined`. Typically backed
   * by a role registry that includes the 5 predefined roles plus any
   * protocol-registered custom roles.
   */
  readonly roleLookup: (roleId: string) => AIRole | undefined;
}

/**
 * Input to `createAgent`. Pure data.
 */
export interface CreateAgentInput {
  readonly agentId: string;
  readonly memoryId: string;
  readonly name: string;
  readonly roleId: string;
  readonly organizationId: string;
  readonly tenantId: string;
  readonly capabilities?: readonly string[];
  readonly boundaries: AutonomousBoundaries;
  /** Caller-supplied epoch-millis. */
  readonly now: number;
}

/**
 * Result of `createAgent`. The created agent + its memory id.
 */
export interface CreateAgentResult {
  readonly agent: AIAgent;
  readonly memoryId: string;
}

/**
 * Create an AI agent with role + boundaries + memory.
 *
 * See file-level JSDoc for the flow. Returns `err(ValidationError)` on
 * validation failure, `ok({ agent, memoryId })` on success.
 */
export function createAgent(
  deps: CreateAgentDeps,
  input: CreateAgentInput
): Result<CreateAgentResult, KernelError> {
  // 1. Validate the role exists (predefined or registered custom).
  const role = deps.roleLookup(input.roleId);
  if (role === undefined) {
    return err(
      new ValidationError(`unknown role '${input.roleId}'`, [
        { field: "roleId", reason: "no such role" },
      ])
    );
  }
  const roleValidation = validateRole(role);
  if (!roleValidation.ok) {
    return roleValidation;
  }

  // 2. Validate the boundaries (pure structural check).
  const boundariesValidation = validateBoundaries(input.boundaries);
  if (!boundariesValidation.ok) {
    return boundariesValidation;
  }

  // 3. Seed the agent's memory with a `context` entry recording its role +
  //    boundaries. This lets the agent remember what it is across turns.
  //    The MemoryStore creates the memory if it doesn't exist.
  const seedEntry = createMemoryEntry({
    id: `${input.memoryId}#seed`,
    kind: "context",
    content: `Agent '${input.name}' (id=${input.agentId}) in role '${role.name}' (id=${role.id}, authority=${role.decisionAuthority}, escalationThreshold=${role.escalationThreshold}). Boundaries: maxDecisionCost=${input.boundaries.maxDecisionCost}, requiresApprovalAbove=${input.boundaries.requiresApprovalAbove}, allowedActions=[${input.boundaries.allowedActions.join(",")}], forbiddenActions=[${input.boundaries.forbiddenActions.join(",")}], maxAutonomousDurationMs=${input.boundaries.maxAutonomousDurationMs}, scope=[${input.boundaries.scope.join(",")}].`,
    confidence: 1.0,
    now: input.now,
  });
  deps.memoryStore.record(input.agentId, seedEntry);

  // 4. Construct the dormant agent.
  const agent = createDormantAgent({
    id: input.agentId,
    name: input.name,
    roleId: input.roleId,
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    capabilities: input.capabilities,
    boundaries: input.boundaries,
    memoryId: input.memoryId,
    now: input.now,
  });

  // 5. Validate the agent (pure structural check).
  const agentValidation = validateAgent(agent);
  if (!agentValidation.ok) {
    return agentValidation;
  }

  // 6. Register the agent. The registry replaces any existing agent with the
  //    same id (idempotent on id).
  deps.registry.register(agent);

  return ok({ agent, memoryId: input.memoryId });
}

/**
 * Use-case class wrapping `createAgent` with constructor-injected deps.
 * Convenient for callers who construct the deps once and call `execute`
 * many times.
 */
export class CreateAgent {
  constructor(private readonly deps: CreateAgentDeps) {}

  execute(input: CreateAgentInput): Result<CreateAgentResult, KernelError> {
    return createAgent(this.deps, input);
  }
}
