# Task M19-experience — Experience Runtime

Agent: experience-runtime
Task: Build the Experience Runtime (Milestone 19 — the FINAL platform milestone).

## Work Log
- Read `worklog.md` (M1-M18 frozen) and `kernel/shared-kernel/interfaces/index.ts` to confirm Result, KernelError, value objects, IDs (no branded IDs used here — the spec uses plain string ids; this matches the M18 twin-runtime pattern).
- Surveyed `kernel/twin-runtime/` (M18 — closest structural reference) to mirror conventions: PORT-only domain interfaces, deterministic `now` argument, JSDoc on every file, `createXxxRuntime()` bundle helper.
- Created `/home/z/my-project/kernel/experience-runtime/` with the prescribed three-layer structure (domain → application → infrastructure → interfaces → root).
- Domain (8 files + index): pure types + pure helpers + PORT interfaces, depending ONLY on `@kernel/shared-kernel` (UnknownRecord). ExperienceIntent + 7 intent types + DEFAULT_INTENT_PRIORITY + INTENT_TYPE_DEFAULT_STAGE + INTENT_TYPE_DEFAULT_TONE; ExperienceJourney + JourneyStage + 5 helpers (findStage/isJourneyTerminal/completedStageCount/activeStage/nextPendingStage); ExperienceSession + SessionContext + SessionDevice + DEFAULT_SESSION_IDLE_MS + DEFAULT_SESSION_CONTEXT + 3 helpers (isSessionLive/effectiveSessionStatus/featureFlag); ExperienceNarrative + NarrativeChapter + 5 tones + 3 helpers (chapterForStage/activeChapter/phraseWithTone); ExperienceGuidance + GuidanceKind (7 kinds) + GuidanceEngine PORT; Milestone + MilestoneCriteria (5 types) + MilestoneTracker PORT + paramString/paramNumber; ExperienceGoal (6 types, 4 statuses) + GoalTracker PORT + goalProgressRatio; SessionUpdate + ExperienceRegistry PORT.
- Application (4 use-cases + index): StartJourneyUseCase (mints journey + narrative + milestones, links into user's session via registry.updateSession, seeds milestones into tracker via narrow optional `seed` cast); AdvanceStageUseCase (marks current active stage completed + next pending stage active OR completes the journey, notifies tracker via `stage-enter:`/`stage-exit:` events, mirrors chapter statuses via mirrorNarrative, generates guidance via engine); CreateSessionUseCase (mints active session with default-or-supplied context); SetGoalUseCase (set + progress + evaluate, with optional registry for lastActivityAt freshness).
- Infrastructure (4 impls + index): InMemoryExperienceRegistry (3 Maps: sessions/journeys/intents; idempotent upserts; insertion-order list snapshots; updateSession merges patches and keeps `terminatedAt` ≥ `lastActivityAt` invariant); DefaultGuidanceEngine (rule-based: no-journey→context, completed→next-step, abandoned→warning, paused→context, active→hint+idle-nudge+progress-context+next-stage+accessibility-tips+device-context+feature-flag-tips+focus-context; per-session cache + monotonic id counter); DefaultMilestoneTracker (event-driven: stage-enter/stage-exit/state events parsed, event-log appended otherwise, evaluate marks achieved/missed based on criteria type; optional concrete `seed`/`setState`/`markAchieved` for `manual` + `state` criteria); DefaultGoalTracker (set/progress/evaluate/listGoals + optional `abandon`/`get`/`listAll`; evaluate flips to achieved (current ≥ target) or missed (deadline elapsed + current < target); abandoned is sticky).
- Infrastructure barrel also exports `ExperienceRuntime` bundle interface + `createExperienceRuntime()` helper wiring all components (startJourney ← registry + milestones; advanceStage ← registry + milestones + guidance; createSession ← registry; setGoal ← goals + registry).
- interfaces/index.ts + root index.ts: re-export the full surface from `@kernel/experience-runtime`.
- Verification: `bunx tsc --noEmit` exits 0; `grep "experience-runtime"` → empty; `grep -v "skills/" | head` → empty. NO `Date.now()` / `Math.random()` in code (only in JSDoc). All 21 files start with JSDoc.

## Files created (21)
- `kernel/experience-runtime/domain/{experience-intent,experience-journey,experience-session,experience-narrative,experience-guidance,experience-milestone,experience-goal,experience-registry,index}.ts`
- `kernel/experience-runtime/application/{start-journey,advance-stage,create-session,set-goal,index}.ts`
- `kernel/experience-runtime/infrastructure/{in-memory-experience-registry,default-guidance-engine,default-milestone-tracker,default-goal-tracker,index}.ts`
- `kernel/experience-runtime/interfaces/index.ts`
- `kernel/experience-runtime/index.ts`

## Final tsc
`bunx tsc --noEmit` exits 0. `grep "experience-runtime"` empty. `grep -v "skills/" | head` empty.
