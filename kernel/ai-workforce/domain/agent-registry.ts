/**
 * @kernel/ai-workforce/domain/agent-registry — the AgentRegistry PORT.
 *
 * The registry is the book of record for AI agents. It supports lookup by
 * id, listing all agents, and filtered listings by team / organization /
 * role. It also supports the only mutation operation: `updateStatus` —
 * lifecycle transitions are the only state change agents undergo after
 * creation (capabilities, boundaries, role are immutable; memory lives in a
 * separate store).
 *
 * The registry PORT is intentionally minimal. Concrete implementations live
 * in `infrastructure/`. The PORT does NOT mandate a specific storage
 * strategy — in-memory, Postgres, or a remote service are all valid.
 *
 * Team membership is NOT stored on the agent — it lives on the `AITeam`. So
 * `listByTeam(teamId)` requires the implementation to consult a team store
 * (or be told the team's member ids). The in-memory implementation accepts
 * an optional `TeamMembershipResolver` to bridge this.
 *
 * Determinism rule: no `Date.now()` / `Math.random()`. `now` is supplied by
 * the caller to `updateStatus`. Listing order is impl-defined but the
 * in-memory implementation sorts by id ascending for reproducibility.
 *
 * Layering: domain depends ONLY on `@kernel/shared-kernel` AND the sibling
 * `ai-agent.ts` (same bounded context — `AIAgent` + `AgentLifecycleState`).
 */
import type { AIAgent, AgentLifecycleState } from "./ai-agent";

/**
 * An optional resolver for team membership. The registry itself does NOT
 * store team membership (it lives on `AITeam.memberIds`), so `listByTeam`
 * needs a way to ask "which agents are on this team?". Implementations may
 * accept this resolver at construction time.
 */
export interface TeamMembershipResolver {
  /** Return the agent ids belonging to `teamId` (director + members). */
  listTeamAgentIds(teamId: string): readonly string[];
}

/**
 * The AgentRegistry PORT. See file-level JSDoc.
 *
 * `register` is the only mutation surface besides `updateStatus`. Both run
 * at BOOT / protocol-install / orchestration time — OUTSIDE the deterministic
 * core (per ADR-0006). The deterministic core only READS the registry.
 */
export interface AgentRegistry {
  /** Register a new agent. Idempotent on id (re-registering replaces). */
  register(agent: AIAgent): void;
  /** Get an agent by id, or `undefined` if not registered. */
  get(id: string): AIAgent | undefined;
  /** List all registered agents (impl-defined order; in-memory sorts by id). */
  list(): readonly AIAgent[];
  /** List agents belonging to `teamId` (director + members). */
  listByTeam(teamId: string): readonly AIAgent[];
  /** List agents belonging to `orgId`. */
  listByOrganization(orgId: string): readonly AIAgent[];
  /** List agents with role `roleId`. */
  listByRole(roleId: string): readonly AIAgent[];
  /**
   * Apply a lifecycle transition to agent `id`. Returns the updated agent, or
   * `undefined` if the agent is not registered. `now` is the caller-supplied
   * epoch-millis for `updatedAt`.
   *
   * Implementations SHOULD enforce `LEGAL_AGENT_TRANSITIONS` (illegal
   * transitions throw `IllegalStateError`). The in-memory implementation
   * delegates to `transition` from `ai-agent.ts`.
   */
  updateStatus(
    id: string,
    status: AgentLifecycleState,
    now: number
  ): AIAgent | undefined;
}

export type { AIAgent, AgentLifecycleState };
