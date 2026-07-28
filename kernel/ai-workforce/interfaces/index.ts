/**
 * @kernel/ai-workforce — public surface.
 *
 * The AI Workforce Runtime — the runtime that lets organizations be run by AI
 * teams rather than single assistants. Provides:
 *   - AIAgent (entity + lifecycle state machine)
 *   - AIRole (5 predefined roles + custom roles)
 *   - AITeam (forming → active → restructuring → dissolved)
 *   - AIOrganization (mirrors a real org with AI agents filling roles)
 *   - AgentMemory (observations / decisions / lessons / context / goals)
 *   - AgentCollaboration (handoffs + messages between agents)
 *   - HumanApproval (human-in-the-loop gate for boundary-exceeding actions)
 *   - AutonomousBoundaries (cost / scope / action envelope)
 *   - AgentRegistry (book of record for agents)
 *
 * Plus 5 application use-cases (createAgent, formTeam, delegateTask,
 * requestApproval, checkBoundaries) and a `createAIWorkforce()` factory that
 * wires a fully-deterministic in-memory workforce bundle.
 *
 * Layered dependency direction:
 *   `interfaces/ → application/ → domain/`
 *   `infrastructure/ → application/ → domain/`
 *   `domain/` depends ONLY on `@kernel/shared-kernel`.
 *
 * Public surface:
 *   - Domain:        AIAgent + lifecycle, AIRole + PREDEFINED_ROLES, AITeam +
 *                    lifecycle, AIOrganization + AIOrgPolicy + OrgNode,
 *                    AgentMemory + MemoryEntry + MemoryStore PORT,
 *                    AgentHandoff + AgentMessage + CollaborationEngine PORT,
 *                    HumanApprovalRequest + ApprovalWorkflow PORT,
 *                    AutonomousBoundaries + BoundaryChecker PORT +
 *                    pure `checkBoundaries`, AgentRegistry PORT
 *   - Application:   createAgent, formTeam, delegateTask, requestApproval,
 *                    checkAgentBoundaries (each as a function + a use-case
 *                    class)
 *   - Infrastructure: InMemoryAgentRegistry, InMemoryMemoryStore,
 *                    InMemoryCollaborationEngine, InMemoryApprovalWorkflow,
 *                    DefaultBoundaryChecker, RoleCatalog, WorkforceFixedClock,
 *                    createAIWorkforce (+CreateAIWorkforceOptions +AIWorkforce
 *                    bundle)
 *
 * Determinism guarantees (enforced):
 *   - NO `Date.now()` / `Math.random()` anywhere.
 *   - All time via injected `RuntimeClock` (default `WorkforceFixedClock` at
 *     0) or caller-supplied `now`.
 *   - All in-memory engines are deterministic (per-instance counter for id
 *     minting; sorted listings).
 *   - Identical inputs → identical outputs, byte-for-byte.
 *
 * !!! ADR-0006 LOUD INVARIANT !!!
 * `register` / `updateStatus` / `record` / `initiateHandoff` / `acceptHandoff`
 * / `sendMessage` / `requestApproval` / `approve` / `reject` / `expire` are
 * the ONLY mutation surfaces and run at BOOT / orchestration time — OUTSIDE
 * the deterministic core. The deterministic core only READS the workforce
 * state.
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
