/**
 * @kernel/ai-workforce/application — barrel.
 *
 * The application layer of the AI Workforce bounded context. Use-cases that
 * orchestrate the domain ports. Depends on `domain/` and
 * `@kernel/shared-kernel` only.
 *
 * Public surface (re-exported through `@kernel/ai-workforce`):
 *   - createAgent       (+ CreateAgentDeps / CreateAgentInput /
 *                         CreateAgentResult + CreateAgent class)
 *   - formTeam          (+ FormTeamDeps / FormTeamInput / FormTeamResult +
 *                         FormTeam class)
 *   - delegateTask      (+ DelegateTaskDeps / DelegateTaskInput /
 *                         DelegateTaskResult + DelegateTask class)
 *   - requestApproval   (+ RequestApprovalDeps / RequestApprovalInput /
 *                         RequestApprovalResult + RequestApproval class)
 *   - checkBoundaries   (+ CheckBoundariesDeps / CheckBoundariesInput /
 *                         CheckBoundariesResultValue + CheckBoundaries class)
 *
 * !!! ADR-0006 LOUD INVARIANT !!!
 * All use-cases run at BOOT / orchestration time — OUTSIDE the deterministic
 * core. The deterministic core only READS the registry / store / engine
 * state.
 */
export * from "./create-agent";
export * from "./form-team";
export * from "./delegate-task";
export * from "./request-approval";
export * from "./check-boundaries";
