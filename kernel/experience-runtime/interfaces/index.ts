/**
 * @kernel/experience-runtime — public surface.
 *
 * The Experience Runtime — the universal runtime that gives every OpsOS
 * application its experience layer. Universal concepts that exist BEFORE the
 * first application:
 *
 *   - ExperienceIntent   — what the user is trying to achieve.
 *   - ExperienceJourney  — the path from intent to fulfillment (stages).
 *   - ExperienceSession  — the live user context (locale, device, a11y, …).
 *   - ExperienceNarrative — human-readable storytelling layered on a journey.
 *   - ExperienceGuidance — adaptive hints / tips / warnings / next-steps.
 *   - Milestone          — checkpoint anchored to a stage (event / state /
 *                          duration / count / manual criteria).
 *   - ExperienceGoal     — long-running cross-journey target.
 *   - ExperienceRegistry — single source of truth for sessions, journeys,
 *                          and intents.
 *
 * Layered dependency direction:
 *   `interfaces/ → application/ → domain/`
 *   `infrastructure/ → application/ → domain/`
 *   `domain/` depends ONLY on `@kernel/shared-kernel`.
 *
 * Public surface:
 *   - Domain (8 files): experience-intent, experience-journey,
 *     experience-session, experience-narrative, experience-guidance,
 *     experience-milestone, experience-goal, experience-registry
 *   - Application (4 use-cases): start-journey, advance-stage,
 *     create-session, set-goal
 *   - Infrastructure (4 in-memory/default impls) + ExperienceRuntime bundle
 *     + createExperienceRuntime() helper
 *
 * Determinism guarantees (enforced):
 *   - NO `Date.now()` / `Math.random()` anywhere in this module.
 *   - All time flows through the `now` argument.
 *   - All guidance generation is rule-based and deterministic.
 *   - All milestone evaluation is event-driven and deterministic.
 *   - All goal evaluation is a pure function of `(goal, now)`.
 */
export * from "../domain";
export * from "../application";
export * from "../infrastructure";
