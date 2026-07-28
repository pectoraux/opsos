/**
 * @kernel/experience-runtime/domain — barrel.
 *
 * The domain layer of the Experience Runtime. Pure types + pure helpers +
 * PORT interfaces. Depends ONLY on `@kernel/shared-kernel`.
 *
 * Public surface:
 *   - ExperienceIntentType, ExperienceIntentStatus, ExperienceIntent,
 *     DEFAULT_INTENT_PRIORITY, INTENT_TYPE_DEFAULT_STAGE,
 *     INTENT_TYPE_DEFAULT_TONE, IntentPayload
 *   - JourneyStageStatus, JourneyStage, JourneyStatus, ExperienceJourney,
 *     findStage, isJourneyTerminal, completedStageCount, activeStage,
 *     nextPendingStage
 *   - SessionDevice, SessionContext, SessionStatus, ExperienceSession,
 *     DEFAULT_SESSION_IDLE_MS, DEFAULT_SESSION_CONTEXT, isSessionLive,
 *     effectiveSessionStatus, featureFlag
 *   - NarrativeTone, NarrativeChapterStatus, NarrativeChapter,
 *     ExperienceNarrative, chapterForStage, activeChapter, phraseWithTone
 *   - GuidanceKind, ExperienceGuidance, GuidanceEngine
 *   - MilestoneCriteriaType, MilestoneStatus, MilestoneCriteria, Milestone,
 *     MilestoneTracker, paramString, paramNumber
 *   - ExperienceGoalType, ExperienceGoalStatus, ExperienceGoal, GoalTracker,
 *     goalProgressRatio
 *   - SessionUpdate, ExperienceRegistry
 */

export * from "./experience-intent";
export * from "./experience-journey";
export * from "./experience-session";
export * from "./experience-narrative";
export * from "./experience-guidance";
export * from "./experience-milestone";
export * from "./experience-goal";
export * from "./experience-registry";
