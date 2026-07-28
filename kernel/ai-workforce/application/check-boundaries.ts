/**
 * @kernel/ai-workforce/application/check-boundaries — use-case: check if an
 * agent can perform an action autonomously (or needs human approval).
 *
 * This is a thin orchestration around the `BoundaryChecker` PORT plus
 * validation that the agent exists. The pure core (`checkBoundaries` in
 * `domain/autonomous-boundaries.ts`) does the actual decision logic; this
 * use-case adds the agent lookup + structural validation.
 *
 * Flow:
 *   1. validate the agent exists + is registered
 *   2. delegate to `BoundaryChecker.check`
 *   3. return the `BoundaryCheckResult`
 *
 * The use-case does NOT enforce the result — it returns the result so the
 * caller (or another use-case like `requestApproval`) can decide what to do.
 *
 * Pure w.r.t. `(deps, input)`: no `Date.now()`, no `Math.random()`. The
 * boundary checker is itself pure (the default implementation is).
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
  type BoundaryCheckResult,
  type BoundaryChecker,
} from "../domain";

/**
 * Dependencies injected by the caller.
 */
export interface CheckBoundariesDeps {
  readonly registry: AgentRegistry;
  readonly boundaryChecker: BoundaryChecker;
}

/**
 * Input to `checkAgentBoundaries`. Pure data.
 */
export interface CheckBoundariesInput {
  readonly agentId: string;
  readonly action: string;
  readonly cost: number;
}

/**
 * Result of `checkAgentBoundaries`. The boundary check result.
 */
export interface CheckBoundariesResultValue {
  readonly result: BoundaryCheckResult;
}

/**
 * Check if an agent can perform an action autonomously.
 *
 * See file-level JSDoc for the flow. Returns `err(ValidationError)` if the
 * agent is not registered, `ok({ result })` otherwise.
 *
 * Named `checkAgentBoundaries` (not `checkBoundaries`) to avoid colliding
 * with the pure domain function `checkBoundaries(boundaries, action, cost)`
 * from `domain/autonomous-boundaries.ts` — they are different things:
 *   - the pure domain function evaluates a `BoundaryCheckResult` for a
 *     given `AutonomousBoundaries` value object;
 *   - this application use-case looks up an agent's boundaries from the
 *     registry (via the `BoundaryChecker` port) and returns the result.
 */
export function checkAgentBoundaries(
  deps: CheckBoundariesDeps,
  input: CheckBoundariesInput
): Result<CheckBoundariesResultValue, KernelError> {
  // 1. Validate the agent exists.
  const agent = deps.registry.get(input.agentId);
  if (agent === undefined) {
    return err(
      new ValidationError(`agent '${input.agentId}' not registered`, [
        { field: "agentId", reason: "no such agent" },
      ])
    );
  }

  // 2. Delegate to the boundary checker.
  const result = deps.boundaryChecker.check(
    input.agentId,
    input.action,
    input.cost
  );

  return ok({ result });
}

/**
 * Use-case class wrapping `checkAgentBoundaries` with constructor-injected
 * deps. Convenient for callers who construct the deps once and call
 * `execute` many times.
 */
export class CheckBoundaries {
  constructor(private readonly deps: CheckBoundariesDeps) {}

  execute(
    input: CheckBoundariesInput
  ): Result<CheckBoundariesResultValue, KernelError> {
    return checkAgentBoundaries(this.deps, input);
  }
}
