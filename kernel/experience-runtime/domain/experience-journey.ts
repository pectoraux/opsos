/**
 * @kernel/experience-runtime/domain/experience-journey — the ExperienceJourney
 * + JourneyStage value objects.
 *
 * A journey maps the path from an intent to its fulfillment as an ordered list
 * of stages. Each stage has a status that progresses `pending → active →
 * completed` (or `skipped`). A journey is the structural backbone of an
 * experience: the narrative is layered on top of it, milestones are anchored
 * to its stages, and guidance is generated from the current stage + session
 * context.
 *
 * Determinism rule: pure types + pure helpers — no `Date.now()`, no
 * `Math.random()`. All time flows through the `now` argument supplied by the
 * caller.
 */

/** The lifecycle status of a single journey stage. */
export type JourneyStageStatus =
  | "pending"
  | "active"
  | "completed"
  | "skipped";

/**
 * A single stage of a journey.
 *
 * - `id` — stable identifier (unique within the journey).
 * - `name` — human-readable name (also used by narrative + guidance).
 * - `order` — zero-based position in the journey.
 * - `status` — lifecycle.
 * - `milestones` — the milestone ids that belong to this stage. Read-only
 *   array; mutated only by creating a new stage value.
 * - `enteredAt` / `exitedAt` — epoch-millis stamps; `undefined` until the
 *   stage transitions into / out of `active`.
 */
export interface JourneyStage {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly status: JourneyStageStatus;
  readonly milestones: readonly string[];
  readonly enteredAt?: number;
  readonly exitedAt?: number;
}

/** The lifecycle status of a journey. */
export type JourneyStatus =
  | "active"
  | "completed"
  | "abandoned"
  | "paused";

/**
 * A single journey. Belongs to a user + application; seeded by an intent.
 *
 * - `stages` — ordered, read-only list. The journey is "completed" when all
 *   non-skipped stages are completed.
 * - `currentStage` — the id of the active stage, or the empty string when the
 *   journey is brand new (no stage entered yet) or completed.
 * - `completedAt` — epoch-millis stamp; `undefined` until the journey
 *   transitions to `completed`.
 */
export interface ExperienceJourney {
  readonly id: string;
  readonly userId: string;
  readonly applicationId: string;
  readonly intentId: string;
  readonly stages: readonly JourneyStage[];
  readonly currentStage: string;
  readonly status: JourneyStatus;
  readonly startedAt: number;
  readonly completedAt?: number;
}

/**
 * Pure helper: find a stage by id. Returns `undefined` if not found.
 * Deterministic — identical inputs → identical output.
 */
export function findStage(
  journey: ExperienceJourney,
  stageId: string,
): JourneyStage | undefined {
  return journey.stages.find((s) => s.id === stageId);
}

/**
 * Pure helper: is the journey in a terminal status? A terminal journey can no
 * longer transition stages.
 */
export function isJourneyTerminal(journey: ExperienceJourney): boolean {
  return journey.status === "completed" || journey.status === "abandoned";
}

/**
 * Pure helper: count how many stages (excluding skipped) are completed. Used
 * by milestone + guidance evaluation to derive progress ratios.
 */
export function completedStageCount(journey: ExperienceJourney): number {
  return journey.stages.filter((s) => s.status === "completed").length;
}

/**
 * Pure helper: the active stage of the journey (the one with status `active`),
 * or `undefined` if there is none (e.g. brand-new or completed journey).
 */
export function activeStage(
  journey: ExperienceJourney,
): JourneyStage | undefined {
  return journey.stages.find((s) => s.status === "active");
}

/**
 * Pure helper: the next pending stage after the current active one (by
 * `order`), or `undefined` if there is none.
 */
export function nextPendingStage(
  journey: ExperienceJourney,
): JourneyStage | undefined {
  const active = activeStage(journey);
  const activeOrder = active ? active.order : -1;
  return journey.stages
    .filter((s) => s.status === "pending" && s.order > activeOrder)
    .sort((a, b) => a.order - b.order)[0];
}
