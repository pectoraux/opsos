/**
 * @kernel/ai-workforce — root entry. Re-exports the public interfaces barrel
 * so `import { ... } from "@kernel/ai-workforce"` resolves the full AI
 * Workforce Runtime contract.
 *
 * The AI Workforce Runtime is the runtime that lets organizations be run by
 * AI teams rather than single assistants. It provides: AI Organization, AI
 * Roles, AI Teams, AI Director, Agent lifecycle, Agent memory, Agent
 * collaboration, Agent handoffs, Human approval workflows, Autonomous
 * execution boundaries. This becomes the runtime that protocols use.
 *
 * Layered dependency direction:
 *   `interfaces/ → application/ → domain/`
 *   `infrastructure/ → application/ → domain/`
 *   `domain/` depends ONLY on `@kernel/shared-kernel`.
 *
 * Determinism: NO `Date.now()` / `Math.random()` anywhere. All time via
 * injected `RuntimeClock` (default `WorkforceFixedClock` at 0) or
 * caller-supplied `now`. All in-memory engines are deterministic.
 */
export * from "./interfaces";
