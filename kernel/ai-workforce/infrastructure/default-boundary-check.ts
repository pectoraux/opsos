/**
 * @kernel/ai-workforce/infrastructure/default-boundary-check — the default
 * `BoundaryChecker` implementation.
 *
 * Wraps the pure `checkBoundaries` function from
 * `domain/autonomous-boundaries.ts`. Looks up the agent's boundaries from the
 * registry, then delegates to `checkBoundaries`. If the agent is not
 * registered, returns `{ allowed: false, requiresApproval: false, reason:
 * "agent not registered" }` (fail-closed — never allow an unregistered agent
 * to act).
 *
 * Determinism: no `Date.now()` / `Math.random()`. The check is a pure
 * function of `(agent.boundaries, action, cost)`.
 *
 * Suitable for kernel self-test and as a reference for protocol authors.
 * Protocols needing richer boundary logic (e.g. context-aware scope checks,
 * time-of-day windows, multi-agent consensus) supply their own
 * `BoundaryChecker` implementation.
 */
import type {
  BoundaryCheckResult,
  BoundaryChecker,
} from "../domain/autonomous-boundaries";
import { checkBoundaries } from "../domain/autonomous-boundaries";
import type { AgentRegistry } from "../domain/agent-registry";

/**
 * Reference `BoundaryChecker`. See file-level JSDoc.
 */
export class DefaultBoundaryChecker implements BoundaryChecker {
  private readonly registry: AgentRegistry;

  constructor(registry: AgentRegistry) {
    this.registry = registry;
  }

  /**
   * Check if agent `agentId` can perform `action` at `cost` autonomously.
   * Returns `{ allowed: false, requiresApproval: false, reason: "agent not
   * registered" }` if the agent is not registered (fail-closed).
   */
  check(agentId: string, action: string, cost: number): BoundaryCheckResult {
    const agent = this.registry.get(agentId);
    if (agent === undefined) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `agent '${agentId}' not registered`,
      };
    }
    return checkBoundaries(agent.boundaries, action, cost);
  }
}
