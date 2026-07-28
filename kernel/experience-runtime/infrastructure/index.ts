/**
 * @kernel/experience-runtime/infrastructure — barrel.
 *
 * The infrastructure layer of the Experience Runtime. Concrete in-memory
 * implementations of every port + the `createExperienceRuntime()` bundle
 * helper. Pure data structures; no `Date.now()`, no `Math.random()`. Suitable
 * for tests, deterministic replay, and as reference implementations for
 * protocol authors.
 *
 * Public surface:
 *   - InMemoryExperienceRegistry
 *   - DefaultGuidanceEngine + GUIDANCE_KIND_PRIORITY +
 *     DEFAULT_ACCESSIBILITY_TIP_CAP + DEFAULT_FEATURE_FLAG_TIP_CAP
 *   - DefaultMilestoneTracker
 *   - DefaultGoalTracker + computeStatus
 *   - ExperienceRuntime (bundle interface)
 *   - createExperienceRuntime() (bundle helper)
 */

import { InMemoryExperienceRegistry } from "./in-memory-experience-registry";
import { DefaultGuidanceEngine } from "./default-guidance-engine";
import { DefaultMilestoneTracker } from "./default-milestone-tracker";
import { DefaultGoalTracker } from "./default-goal-tracker";

import { StartJourneyUseCase } from "../application/start-journey";
import { AdvanceStageUseCase } from "../application/advance-stage";
import { CreateSessionUseCase } from "../application/create-session";
import { SetGoalUseCase } from "../application/set-goal";

export { InMemoryExperienceRegistry } from "./in-memory-experience-registry";
export {
  DefaultGuidanceEngine,
  GUIDANCE_KIND_PRIORITY,
  DEFAULT_ACCESSIBILITY_TIP_CAP,
  DEFAULT_FEATURE_FLAG_TIP_CAP,
} from "./default-guidance-engine";
export { DefaultMilestoneTracker } from "./default-milestone-tracker";
export { DefaultGoalTracker, computeStatus } from "./default-goal-tracker";

/**
 * A convenience bundle of every experience-runtime component + the wired
 * use-cases. Construct one per experience-runtime session and pass the
 * components individually (or as a bundle) to higher-level services.
 *
 * The bundle wires internal cross-references:
 *   - `startJourney` writes through `registry` + `milestones` and links the
 *     journey into the user's latest session via `registry.updateSession`.
 *   - `advanceStage` writes through `registry` + `milestones` + `guidance`.
 *   - `createSession` writes through `registry`.
 *   - `setGoal` writes through `goals` (+ `registry` if supplied for
 *     lastActivityAt freshness).
 */
export interface ExperienceRuntime {
  readonly registry: InMemoryExperienceRegistry;
  readonly guidance: DefaultGuidanceEngine;
  readonly milestones: DefaultMilestoneTracker;
  readonly goals: DefaultGoalTracker;

  readonly startJourney: StartJourneyUseCase;
  readonly advanceStage: AdvanceStageUseCase;
  readonly createSession: CreateSessionUseCase;
  readonly setGoal: SetGoalUseCase;
}

/**
 * Construct a fresh bundle of in-memory experience-runtime components. Each
 * component is a new instance with empty state. Cross-references between
 * components are wired (startJourney → registry + milestones; advanceStage →
 * registry + milestones + guidance; createSession → registry; setGoal →
 * goals + registry).
 */
export function createExperienceRuntime(): ExperienceRuntime {
  const registry = new InMemoryExperienceRegistry();
  const guidance = new DefaultGuidanceEngine();
  const milestones = new DefaultMilestoneTracker();
  const goals = new DefaultGoalTracker();

  const startJourney = new StartJourneyUseCase(registry, milestones);
  const advanceStage = new AdvanceStageUseCase(registry, milestones, guidance);
  const createSession = new CreateSessionUseCase(registry);
  const setGoal = new SetGoalUseCase(goals, registry);

  return {
    registry,
    guidance,
    milestones,
    goals,
    startJourney,
    advanceStage,
    createSession,
    setGoal,
  };
}
