/**
 * @kernel/ai-workforce/infrastructure/in-memory-agent-registry — the
 * reference Map-based `AgentRegistry`.
 *
 * Holds agents in a `Map<string, AIAgent>` keyed by id (insertion order
 * preserved). All listing methods return fresh arrays sorted by id ascending
 * for reproducibility regardless of insertion order.
 *
 * `register` is idempotent on id (re-registering replaces). `updateStatus`
 * delegates to `transition` from `domain/ai-agent.ts` (illegal transitions
 * throw `IllegalStateError`).
 *
 * `listByTeam` consults an optional `TeamMembershipResolver` (the registry
 * itself does NOT store team membership — it lives on `AITeam.memberIds`).
 * If no resolver is supplied, `listByTeam` returns `[]`.
 *
 * Suitable for kernel self-test, the read-only inspector, and tests. NOT for
 * production persistence (no durability, no concurrency control beyond JS's
 * single-threaded execution, no role-based access control).
 *
 * !!! ADR-0006 LOUD INVARIANT !!!
 * `register` / `updateStatus` are the ONLY mutation surfaces and run at
 * BOOT / orchestration time — OUTSIDE the deterministic core. The
 * deterministic core only READS the registry.
 *
 * Determinism: no `Date.now()` / `Math.random()`. The registry is pure data;
 * the only side-effect is mutation of in-memory maps.
 */
import { IllegalStateError } from "@kernel/shared-kernel";
import type {
  AIAgent,
  AgentLifecycleState,
  AgentRegistry,
  TeamMembershipResolver,
} from "../domain";
import { transition } from "../domain";

/**
 * Reference in-memory `AgentRegistry`. See file-level JSDoc.
 */
export class InMemoryAgentRegistry implements AgentRegistry {
  /** Registered agents keyed by id. Insertion order preserved. */
  private readonly agents: Map<string, AIAgent> = new Map();

  /** Optional team-membership resolver for `listByTeam`. */
  private readonly teamResolver?: TeamMembershipResolver;

  constructor(teamResolver?: TeamMembershipResolver) {
    this.teamResolver = teamResolver;
  }

  /**
   * Register an agent. Idempotent on id (re-registering replaces). Pure
   * side-effect: mutates the internal map.
   *
   * !!! ADR-0006: called at BOOT / orchestration time — OUTSIDE the
   * deterministic core.
   */
  register(agent: AIAgent): void {
    this.agents.set(agent.id, agent);
  }

  /** Get an agent by id, or `undefined` if not registered. */
  get(id: string): AIAgent | undefined {
    return this.agents.get(id);
  }

  /** List all agents, sorted by id ascending. Fresh array each call. */
  list(): readonly AIAgent[] {
    return Array.from(this.agents.values()).sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    );
  }

  /**
   * List agents belonging to `teamId` (director + members). Requires a
   * `TeamMembershipResolver` to have been supplied at construction; if none
   * was supplied, returns `[]`. Fresh array each call, sorted by id.
   */
  listByTeam(teamId: string): readonly AIAgent[] {
    if (this.teamResolver === undefined) {
      return [];
    }
    const agentIds = this.teamResolver.listTeamAgentIds(teamId);
    const out: AIAgent[] = [];
    for (const id of agentIds) {
      const agent = this.agents.get(id);
      if (agent !== undefined) {
        out.push(agent);
      }
    }
    return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  /** List agents in `orgId`, sorted by id ascending. Fresh array each call. */
  listByOrganization(orgId: string): readonly AIAgent[] {
    return Array.from(this.agents.values())
      .filter((a) => a.organizationId === orgId)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  /** List agents with `roleId`, sorted by id ascending. Fresh array each call. */
  listByRole(roleId: string): readonly AIAgent[] {
    return Array.from(this.agents.values())
      .filter((a) => a.roleId === roleId)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  /**
   * Apply a lifecycle transition to agent `id`. Returns the updated agent, or
   * `undefined` if not registered. Throws `IllegalStateError` on illegal
   * transition (delegates to `transition` from `domain/ai-agent.ts`).
   *
   * !!! ADR-0006: called at BOOT / orchestration time — OUTSIDE the
   * deterministic core.
   */
  updateStatus(
    id: string,
    status: AgentLifecycleState,
    now: number
  ): AIAgent | undefined {
    const agent = this.agents.get(id);
    if (agent === undefined) {
      return undefined;
    }
    let next: AIAgent;
    try {
      next = transition(agent, status, now);
    } catch (e) {
      // Re-throw IllegalStateError verbatim; wrap unknown errors.
      if (e instanceof IllegalStateError) throw e;
      throw new IllegalStateError(
        `Agent '${id}' failed to transition to '${status}': ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
    this.agents.set(id, next);
    return next;
  }

  // ── Introspection helpers (NOT part of the AgentRegistry port) ──────────

  /** Number of registered agents. For tests / diagnostics. */
  size(): number {
    return this.agents.size;
  }

  /** True iff an agent with `id` is registered. For tests / diagnostics. */
  has(id: string): boolean {
    return this.agents.has(id);
  }

  /** Remove all registered agents. For tests / diagnostics. */
  clear(): void {
    this.agents.clear();
  }
}
