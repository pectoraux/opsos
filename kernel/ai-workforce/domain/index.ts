/**
 * @kernel/ai-workforce/domain — barrel.
 *
 * Pure domain layer of the AI Workforce bounded context. Contains:
 *   - AIAgent (entity + lifecycle state machine + validation)
 *   - AIRole (value object + 5 predefined roles + validation)
 *   - AITeam (value object + lifecycle state machine + validation)
 *   - AIOrganization (value object + AIOrgPolicy + OrgNode + validation)
 *   - AgentMemory + MemoryEntry + MemoryStore PORT
 *   - AgentHandoff + AgentMessage + AgentCollaboration +
 *     CollaborationEngine PORT
 *   - HumanApprovalRequest + ApprovalWorkflow PORT
 *   - AutonomousBoundaries + BoundaryChecker PORT + pure `checkBoundaries`
 *   - AgentRegistry PORT (+ TeamMembershipResolver helper)
 *
 * Depends ONLY on `@kernel/shared-kernel` (`Result` / `KernelError` /
 * `ValidationError` / `IllegalStateError`). No I/O, no `Date.now()`, no
 * `Math.random()`. All time flows through caller-supplied `now` arguments.
 *
 * Public surface (re-exported through `@kernel/ai-workforce`):
 *   - AIAgent:        `AgentLifecycleState`, `AIAgent`,
 *                     `LEGAL_AGENT_TRANSITIONS`, `canTransition`,
 *                     `transition`, `validateAgent`, `createDormantAgent`
 *   - AIRole:         `DecisionAuthority`, `AIRole`, `PREDEFINED_ROLES`,
 *                     `getPredefinedRole`, `validateRole`
 *   - AITeam:         `AITeamStatus`, `AITeam`, `LEGAL_TEAM_TRANSITIONS`,
 *                     `canTransitionTeam`, `transitionTeam`, `validateTeam`,
 *                     `createFormingTeam`
 *   - AIOrganization: `AIOrgPolicy`, `OrgNode`, `AIOrganization`,
 *                     `validateOrganization`, `createAIOrganization`
 *   - Memory:         `MemoryEntryKind`, `MemoryEntry`, `AgentMemory`,
 *                     `MemoryStore`, `validateMemoryEntry`, `createMemoryEntry`
 *   - Collaboration:  `AgentHandoffStatus`, `AgentMessageKind`,
 *                     `AgentMessageStatus`, `AgentHandoff`, `AgentMessage`,
 *                     `SharedContext`, `AgentCollaboration`,
 *                     `CollaborationEngine`, `LEGAL_HANDOFF_TRANSITIONS`,
 *                     `canTransitionHandoff`, `transitionHandoff`,
 *                     `validateHandoff`, `validateMessage`
 *   - Approval:       `ApprovalRisk`, `ApprovalStatus`,
 *                     `HumanApprovalRequest`, `ApprovalWorkflow`,
 *                     `LEGAL_APPROVAL_TRANSITIONS`, `canTransitionApproval`,
 *                     `transitionApproval`, `validateApprovalRequest`
 *   - Boundaries:     `AutonomousBoundaries`, `BoundaryCheckResult`,
 *                     `BoundaryChecker`, `checkBoundaries`,
 *                     `validateBoundaries`, `createBoundaries`,
 *                     `DEFAULT_BOUNDARIES`
 *   - Registry:       `AgentRegistry`, `TeamMembershipResolver`
 */
export * from "./ai-agent";
export * from "./ai-role";
export * from "./ai-team";
export * from "./ai-organization";
export * from "./agent-memory";
export * from "./agent-collaboration";
export * from "./human-approval";
export * from "./autonomous-boundaries";
export * from "./agent-registry";
