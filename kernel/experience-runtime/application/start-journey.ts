/**
 * @kernel/experience-runtime/application/start-journey — use-case: start a
 * journey for a user's intent.
 *
 * Given an intent (already registered or supplied inline), mint a fresh
 * `ExperienceJourney` with the supplied (or default) stage list, a fresh
 * `ExperienceNarrative` with one chapter per stage, and a set of
 * `Milestone`s (one per stage that supplies a `milestone` descriptor). All
 * three are registered with the registry / tracker; the journey is returned
 * alongside the narrative and the milestone ids.
 *
 * Determinism rule: identical inputs + identical ports → identical outputs.
 * The caller supplies `now` and (optionally) deterministic id producers.
 */

import type {
  ExperienceIntent,
  ExperienceJourney,
  ExperienceNarrative,
  ExperienceRegistry,
  JourneyStage,
  Milestone,
  MilestoneCriteria,
  MilestoneTracker,
  NarrativeChapter,
  NarrativeTone,
} from "../domain";
import {
  INTENT_TYPE_DEFAULT_STAGE,
  INTENT_TYPE_DEFAULT_TONE,
} from "../domain";
import type { UnknownRecord } from "@kernel/shared-kernel";

/**
 * Descriptor for one stage of the journey to be created. `milestone` is
 * optional; when supplied, a `Milestone` is created for the stage.
 */
export interface StartJourneyStageDescriptor {
  readonly id: string;
  readonly name: string;
  readonly milestone?: {
    readonly name: string;
    readonly description: string;
    readonly criteria: MilestoneCriteria;
  };
}

/** The input to `StartJourney.execute`. Pure data. */
export interface StartJourneyInput {
  readonly intent: ExperienceIntent;
  /** Optional explicit stages; defaults to a single stage derived from the intent type. */
  readonly stages?: readonly StartJourneyStageDescriptor[];
  /** Optional explicit narrative tone; defaults to the intent-type default. */
  readonly tone?: NarrativeTone;
  /** Optional narrative language (BCP-47 tag). Defaults to "en-US". */
  readonly language?: string;
  /** Clock-sourced epoch-millis — used as `startedAt` / `createdAt`. */
  readonly now: number;
  /** Deterministic id for the new journey. Caller-supplied. */
  readonly journeyId: string;
  /** Deterministic id for the new narrative. Caller-supplied. */
  readonly narrativeId: string;
}

/** The result of `StartJourney.execute`. */
export interface StartJourneyResult {
  readonly journey: ExperienceJourney;
  readonly narrative: ExperienceNarrative;
  readonly milestones: readonly Milestone[];
}

/** The use-case PORT. */
export interface StartJourney {
  execute(input: StartJourneyInput): StartJourneyResult;
}

/**
 * Default implementation. Orchestrates the registry + milestone tracker.
 *
 * Behavior:
 *   - If `stages` is omitted, mints a single stage whose id + name come from
 *     `INTENT_TYPE_DEFAULT_STAGE[intent.type]`.
 *   - The first stage is `active` (with `enteredAt = now`); the rest are
 *     `pending`.
 *   - One `NarrativeChapter` per stage (id = `${stageId}#chapter`, title =
 *     stage name, content = empty string for the first stage and a generic
 *     "Pending" placeholder for the rest, status mirrors the stage).
 *   - One `Milestone` per stage that supplies a `milestone` descriptor
 *     (status `pending`, registered via `MilestoneTracker.set`-equivalent
 *     seeding through the registry). Milestone ids are deterministic:
 *     `${journeyId}#${stageId}#m`.
 *   - The journey is registered via `ExperienceRegistry.registerJourney` and
 *     its id is also written to the intent's session (if one exists for the
 *     user + application) via `updateSession`.
 */
export class StartJourneyUseCase implements StartJourney {
  constructor(
    private readonly registry: ExperienceRegistry,
    private readonly milestones: MilestoneTracker,
  ) {}

  execute(input: StartJourneyInput): StartJourneyResult {
    const { intent, now } = input;
    const tone: NarrativeTone = input.tone ?? INTENT_TYPE_DEFAULT_TONE[intent.type];
    const language = input.language ?? "en-US";

    // Resolve stage descriptors (default to a single stage from the intent type).
    const descriptors: readonly StartJourneyStageDescriptor[] =
      input.stages ?? defaultStagesForIntent(intent);

    // Build the immutable stage values.
    const stages: JourneyStage[] = descriptors.map((d, i) => ({
      id: d.id,
      name: d.name,
      order: i,
      status: i === 0 ? "active" : "pending",
      milestones: d.milestone ? [`${input.journeyId}#${d.id}#m`] : [],
      enteredAt: i === 0 ? now : undefined,
      exitedAt: undefined,
    }));

    // Build the immutable narrative chapters.
    const chapters: NarrativeChapter[] = descriptors.map((d, i) => ({
      id: `${d.id}#chapter`,
      title: d.name,
      content: i === 0 ? "" : "Pending",
      stage: d.id,
      order: i,
      status: i === 0 ? "active" : "pending",
    }));

    // Build the journey value.
    const journey: ExperienceJourney = {
      id: input.journeyId,
      userId: intent.userId,
      applicationId: intent.applicationId,
      intentId: intent.id,
      stages,
      currentStage: stages[0]?.id ?? "",
      status: "active",
      startedAt: now,
    };

    // Build the narrative value.
    const narrative: ExperienceNarrative = {
      id: input.narrativeId,
      journeyId: journey.id,
      chapters,
      currentChapter: chapters[0]?.id ?? "",
      tone,
      language,
    };

    // Build the milestones (one per stage that supplies a descriptor).
    const createdMilestones: Milestone[] = descriptors.flatMap((d) =>
      d.milestone
        ? [
            {
              id: `${input.journeyId}#${d.id}#m`,
              journeyId: journey.id,
              name: d.milestone.name,
              description: d.milestone.description,
              stage: d.id,
              status: "pending" as const,
              criteria: d.milestone.criteria,
            },
          ]
        : [],
    );

    // Register the journey + intent + link the journey into the user's session
    // (if one exists for this user + application).
    this.registry.registerJourney(journey);
    this.registry.registerIntent(intent);

    // Seed the milestone tracker with the freshly-created milestones. The
    // tracker's `set` API isn't on the port (the port only has `track` /
    // `evaluate` / `listMilestones`); we re-seed by registering each milestone
    // via the tracker's own seed mechanism. We use a narrow cast: concrete
    // in-memory trackers expose `seed(milestone)`. If the tracker does not,
    // the milestone is still recorded in the result (just not tracked).
    seedMilestones(this.milestones, createdMilestones);

    // Link the journey into the user's latest active session, if any.
    const sessions = this.registry.listSessions(intent.userId);
    const session = sessions.find(
      (s) => s.applicationId === intent.applicationId && s.status !== "terminated",
    );
    if (session) {
      this.registry.updateSession(
        session.id,
        { journeyId: journey.id, lastActivityAt: now },
        now,
      );
    }

    return { journey, narrative, milestones: createdMilestones };
  }
}

/**
 * Build a single-stage descriptor list from an intent's type. Pure helper —
 * deterministic. The single stage's id + name come from
 * `INTENT_TYPE_DEFAULT_STAGE[intent.type]`; no milestone is attached (the
 * caller may attach one explicitly via `stages`).
 */
export function defaultStagesForIntent(
  intent: ExperienceIntent,
): readonly StartJourneyStageDescriptor[] {
  const stageName = INTENT_TYPE_DEFAULT_STAGE[intent.type];
  return [
    {
      id: stageName,
      name: stageName.charAt(0).toUpperCase() + stageName.slice(1),
    },
  ];
}

/**
 * Helper: seed milestones into a tracker. The `MilestoneTracker` PORT does
 * not expose a public `seed`, so we use an optional `seed` method on the
 * concrete tracker (the in-memory implementation provides it). If the
 * tracker does not expose `seed`, the milestones are simply not tracked —
 * the caller still receives them in the result.
 *
 * The cast is intentional and narrow: it checks for the optional `seed`
 * method without forcing every tracker to implement it.
 */
function seedMilestones(
  tracker: MilestoneTracker,
  milestones: readonly Milestone[],
): void {
  const t = tracker as MilestoneTracker & {
    seed?(milestone: Milestone): void;
  };
  if (typeof t.seed === "function") {
    for (const m of milestones) t.seed(m);
  }
}

/**
 * Helper: an UnknownRecord alias for the (unused) payload parameter that
 * keeps the file's imports tidy. Currently a no-op but reserved for future
 * narrative-content templating.
 */
export type JourneyPayload = UnknownRecord;
