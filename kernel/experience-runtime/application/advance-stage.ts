/**
 * @kernel/experience-runtime/application/advance-stage — use-case: advance a
 * journey to its next stage.
 *
 * Marks the current active stage `completed` (stamps `exitedAt = now`), marks
 * the next pending stage `active` (stamps `enteredAt = now`), and — if there
 * is no next pending stage — flips the journey to `completed` (stamps
 * `completedAt = now`). After the transition, the milestone tracker is
 * notified (so duration / state / count criteria are re-evaluated and any
 * pending milestone of the just-exited stage is marked `missed`), and the
 * guidance engine generates a fresh batch of guidance for the new state.
 *
 * Determinism rule: identical inputs + identical ports → identical outputs.
 * The caller supplies `now` and (optionally) the current narrative + session
 * so the use-case can keep them in lockstep with the journey.
 */

import type {
  ExperienceGuidance,
  ExperienceJourney,
  ExperienceNarrative,
  ExperienceRegistry,
  ExperienceSession,
  GuidanceEngine,
  JourneyStage,
  Milestone,
  MilestoneTracker,
  NarrativeChapter,
} from "../domain";
import { isJourneyTerminal, nextPendingStage, activeStage } from "../domain";

/** The input to `AdvanceStage.execute`. Pure data. */
export interface AdvanceStageInput {
  readonly journeyId: string;
  /** Clock-sourced epoch-millis. */
  readonly now: number;
  /**
   * Optional narrative to keep in lockstep with the stage transition. If
   * supplied, the chapter matching the just-exited stage transitions to
   * `completed` and the chapter matching the new active stage transitions to
   * `active`. The updated narrative is returned in the result.
   */
  readonly narrative?: ExperienceNarrative;
  /**
   * Optional session used for guidance generation. If omitted, the use-case
   * looks up the user's latest non-terminated session for the journey's
   * application via the registry. If no session is found, no guidance is
   * generated.
   */
  readonly session?: ExperienceSession;
  /**
   * Optional context bag passed verbatim to the guidance engine. Applications
   * use this to feed application-specific signals (e.g. "form dirty", "item
   * selected") into guidance generation.
   */
  readonly context?: Readonly<Record<string, unknown>>;
}

/** The result of `AdvanceStage.execute`. */
export interface AdvanceStageResult {
  /** The updated journey. */
  readonly journey: ExperienceJourney;
  /** The updated narrative, or `undefined` if none was supplied. */
  readonly narrative: ExperienceNarrative | undefined;
  /** The milestone set after evaluation. */
  readonly milestones: readonly Milestone[];
  /** Guidance generated for the new state (possibly empty). */
  readonly guidance: readonly ExperienceGuidance[];
  /**
   * `true` if a stage transition actually occurred. `false` if the journey
   * was already terminal or had no next pending stage (in which case the
   * journey is returned unchanged).
   */
  readonly advanced: boolean;
}

/** The use-case PORT. */
export interface AdvanceStage {
  execute(input: AdvanceStageInput): AdvanceStageResult;
}

/**
 * Default implementation. Orchestrates the registry + milestone tracker +
 * guidance engine.
 *
 * Step-by-step:
 *   1. Look up the journey; if missing, throw `NotFoundError`-style result
 *      (here we return an empty result with `advanced=false` because the
 *      use-case is total — never throws).
 *   2. If the journey is terminal, return it unchanged (`advanced=false`).
 *   3. Find the current active stage. If there is none, return unchanged.
 *   4. Mark the active stage `completed` (stamp `exitedAt = now`).
 *   5. Find the next pending stage (by `order`).
 *   6. If there is one: mark it `active` (stamp `enteredAt = now`); set
 *      `journey.currentStage` to its id.
 *      If there is none: set the journey to `completed` (stamp
 *      `completedAt = now`); set `journey.currentStage` to "".
 *   7. Register the updated journey via `registry.registerJourney` (upsert).
 *   8. Notify the milestone tracker of the transition via `track`
 *      (`stage-exit:<oldStageId>` + `stage-enter:<newStageId>`), then call
 *      `evaluate(journeyId, now)` to refresh statuses.
 *   9. If a narrative was supplied, mirror the chapter status transitions
 *      (active→completed for the just-exited stage's chapter;
 *      pending→active for the new stage's chapter; if the journey
 *      completed, mark the last chapter completed too).
 *  10. Resolve a session (from input or registry) and call
 *      `guidanceEngine.generate(session, journey, context, now)`.
 */
export class AdvanceStageUseCase implements AdvanceStage {
  constructor(
    private readonly registry: ExperienceRegistry,
    private readonly milestones: MilestoneTracker,
    private readonly guidance: GuidanceEngine,
  ) {}

  execute(input: AdvanceStageInput): AdvanceStageResult {
    const journey = this.registry.getJourney(input.journeyId);
    if (!journey) {
      return {
        journey: emptyJourney(input.journeyId),
        narrative: input.narrative,
        milestones: [],
        guidance: [],
        advanced: false,
      };
    }
    if (isJourneyTerminal(journey)) {
      return {
        journey,
        narrative: input.narrative,
        milestones: this.milestones.listMilestones(journey.id),
        guidance: [],
        advanced: false,
      };
    }

    const current = activeStage(journey);
    if (!current) {
      return {
        journey,
        narrative: input.narrative,
        milestones: this.milestones.listMilestones(journey.id),
        guidance: [],
        advanced: false,
      };
    }

    const next = nextPendingStage(journey);
    const now = input.now;

    // Build the new stage list with the transition applied.
    const newStages: JourneyStage[] = journey.stages.map((s) => {
      if (s.id === current.id) {
        return { ...s, status: "completed", exitedAt: now };
      }
      if (next && s.id === next.id) {
        return { ...s, status: "active", enteredAt: now };
      }
      return s;
    });

    const newJourney: ExperienceJourney = next
      ? {
          ...journey,
          stages: newStages,
          currentStage: next.id,
          status: "active",
        }
      : {
          ...journey,
          stages: newStages,
          currentStage: "",
          status: "completed",
          completedAt: now,
        };

    this.registry.registerJourney(newJourney);

    // Notify the tracker of the transition. The tracker uses these events to
    // (a) record the new stage's enter time for duration-criteria milestones,
    // (b) mark pending milestones of the exited stage as `missed` during
    // `evaluate`.
    this.milestones.track(journey.id, `stage-exit:${current.id}`, now);
    if (next) {
      this.milestones.track(journey.id, `stage-enter:${next.id}`, now);
    }
    const evaluatedMilestones = this.milestones.evaluate(journey.id, now);

    // Mirror chapter statuses in the supplied narrative (if any).
    const newNarrative = input.narrative
      ? mirrorNarrative(
          input.narrative,
          current.id,
          next?.id,
          newJourney.status,
        )
      : undefined;

    // Resolve a session for guidance generation.
    const session =
      input.session ?? this.findSessionForJourney(newJourney);
    let guidance: readonly ExperienceGuidance[] = [];
    if (session) {
      guidance = this.guidance.generate(
        session,
        newJourney,
        input.context ?? {},
        now,
      );
    }

    return {
      journey: newJourney,
      narrative: newNarrative,
      milestones: evaluatedMilestones,
      guidance,
      advanced: true,
    };
  }

  private findSessionForJourney(
    journey: ExperienceJourney,
  ): ExperienceSession | undefined {
    const sessions = this.registry.listSessions(journey.userId);
    return sessions.find(
      (s) =>
        s.applicationId === journey.applicationId &&
        s.status !== "terminated",
    );
  }
}

/**
 * Pure helper: produce a new narrative value mirroring the stage transition.
 * The just-exited stage's chapter transitions `active → completed`; the new
 * stage's chapter transitions `pending → active`. If the journey completed,
 * the active chapter (if any) also transitions to `completed`.
 *
 * Deterministic — pure function of `(narrative, exitedStageId, enteredStageId, journeyStatus)`.
 */
export function mirrorNarrative(
  narrative: ExperienceNarrative,
  exitedStageId: string,
  enteredStageId: string | undefined,
  journeyStatus: ExperienceJourney["status"],
): ExperienceNarrative {
  const chapters: NarrativeChapter[] = narrative.chapters.map((c) => {
    if (c.stage === exitedStageId) {
      return { ...c, status: "completed" };
    }
    if (enteredStageId && c.stage === enteredStageId) {
      return { ...c, status: "active" };
    }
    return c;
  });

  let currentChapter = enteredStageId
    ? chapters.find((c) => c.stage === enteredStageId)?.id ??
      narrative.currentChapter
    : "";

  // If the journey completed, mark the active chapter as completed and clear
  // `currentChapter`.
  if (journeyStatus === "completed") {
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i].status === "active") {
        chapters[i] = { ...chapters[i], status: "completed" };
      }
    }
    currentChapter = "";
  }

  return {
    ...narrative,
    chapters,
    currentChapter,
  };
}

/** Pure helper: build an empty placeholder journey value (used when the
 *  journey id does not resolve). The id is preserved so callers can detect
 *  the not-found case by comparing `journey.id === input.journeyId` AND
 *  `advanced === false` AND `journey.stages.length === 0`. */
function emptyJourney(id: string): ExperienceJourney {
  return {
    id,
    userId: "",
    applicationId: "",
    intentId: "",
    stages: [],
    currentStage: "",
    status: "abandoned",
    startedAt: 0,
  };
}
