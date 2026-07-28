/**
 * @kernel/experience-runtime/application — barrel.
 *
 * The application layer of the Experience Runtime. Use-cases that orchestrate
 * the domain ports. Depends on `domain/` and `@kernel/shared-kernel` only.
 *
 * Public surface:
 *   - StartJourney use-case + StartJourneyUseCase class +
 *     StartJourneyStageDescriptor + StartJourneyInput + StartJourneyResult +
 *     defaultStagesForIntent
 *   - AdvanceStage use-case + AdvanceStageUseCase class +
 *     AdvanceStageInput + AdvanceStageResult + mirrorNarrative
 *   - CreateSession use-case + CreateSessionUseCase class +
 *     CreateSessionInput + CreateSessionResult
 *   - SetGoal use-case + SetGoalUseCase class + SetGoalInput + SetGoalResult
 *     + ProgressGoalInput + ProgressGoalResult
 */

export type {
  StartJourneyStageDescriptor,
  StartJourneyInput,
  StartJourneyResult,
  StartJourney,
} from "./start-journey";
export { StartJourneyUseCase, defaultStagesForIntent } from "./start-journey";

export type {
  AdvanceStageInput,
  AdvanceStageResult,
  AdvanceStage,
} from "./advance-stage";
export { AdvanceStageUseCase, mirrorNarrative } from "./advance-stage";

export type {
  CreateSessionInput,
  CreateSessionResult,
  CreateSession,
} from "./create-session";
export { CreateSessionUseCase } from "./create-session";

export type {
  SetGoalInput,
  SetGoalResult,
  ProgressGoalInput,
  ProgressGoalResult,
  SetGoal,
} from "./set-goal";
export { SetGoalUseCase } from "./set-goal";
