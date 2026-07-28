/**
 * @kernel/experience-runtime/domain/experience-narrative — the
 * ExperienceNarrative + NarrativeChapter value objects.
 *
 * The narrative layer gives a journey human-readable storytelling. A
 * narrative belongs to a journey; its chapters are 1:1 with the journey's
 * stages (matched by `stage` id) but carry `title` + `content` text. A
 * narrative also has a `tone` (which influences phrasing) and a `language`.
 * The narrative is what the UI renders above/beside the controls of the
 * current stage.
 *
 * Determinism rule: pure types + pure helpers — no `Date.now()`, no
 * `Math.random()`. All time flows through the `now` argument supplied by the
 * caller.
 */

/** The canonical narrative tones. */
export type NarrativeTone =
  | "professional"
  | "friendly"
  | "concise"
  | "detailed"
  | "guided";

/** The lifecycle status of a single narrative chapter. */
export type NarrativeChapterStatus = "pending" | "active" | "completed";

/**
 * A single chapter of a narrative. `stage` is the id of the journey stage
 * this chapter describes; `order` matches the stage's order.
 */
export interface NarrativeChapter {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly stage: string;
  readonly order: number;
  readonly status: NarrativeChapterStatus;
}

/**
 * A single narrative. Belongs to exactly one journey.
 *
 * - `chapters` — ordered, read-only list (1:1 with the journey's stages).
 * - `currentChapter` — the id of the active chapter, or the empty string when
 *   the narrative is brand new or completed.
 * - `tone` — influences phrasing (used by guidance generation).
 * - `language` — BCP-47 language tag (e.g. "en-US").
 */
export interface ExperienceNarrative {
  readonly id: string;
  readonly journeyId: string;
  readonly chapters: readonly NarrativeChapter[];
  readonly currentChapter: string;
  readonly tone: NarrativeTone;
  readonly language: string;
}

/**
 * Pure helper: find a chapter by the stage id it describes. Returns
 * `undefined` if not found.
 */
export function chapterForStage(
  narrative: ExperienceNarrative,
  stageId: string,
): NarrativeChapter | undefined {
  return narrative.chapters.find((c) => c.stage === stageId);
}

/**
 * Pure helper: the active chapter of the narrative (status `active`), or
 * `undefined` if there is none.
 */
export function activeChapter(
  narrative: ExperienceNarrative,
): NarrativeChapter | undefined {
  return narrative.chapters.find((c) => c.status === "active");
}

/**
 * Pure helper: prefix a content string with a tone-appropriate leading clause.
 * Used by guidance generation to phrase hints consistently with the narrative
 * tone. Deterministic — pure function of `(tone, content)`.
 */
export function phraseWithTone(
  tone: NarrativeTone,
  content: string,
): string {
  switch (tone) {
    case "friendly":
      return `Heads up — ${content}`;
    case "concise":
      return content;
    case "detailed":
      return `For context: ${content}`;
    case "guided":
      return `Step: ${content}`;
    case "professional":
    default:
      return content;
  }
}
