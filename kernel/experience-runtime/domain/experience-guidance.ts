/**
 * @kernel/experience-runtime/domain/experience-guidance — the
 * ExperienceGuidance value object + the GuidanceEngine PORT.
 *
 * Guidance is the adaptive layer between the platform and the user: hints,
 * tips, warnings, instructions, recommendations, next-steps, and contextual
 * notes that are generated from the current session + journey + arbitrary
 * context. Guidance is always rule-based and deterministic — never
 * randomized, never sourced from an opaque model — so that the same inputs
 * always produce the same guidance.
 *
 * Determinism rule: pure types + a pure PORT contract — no `Date.now()`, no
 * `Math.random()`. All time flows through the `now` argument supplied by the
 * caller.
 */

import type { ExperienceSession } from "./experience-session";
import type { ExperienceJourney } from "./experience-journey";

/** The canonical guidance kinds. */
export type GuidanceKind =
  | "hint"
  | "tip"
  | "warning"
  | "instruction"
  | "recommendation"
  | "next-step"
  | "context";

/**
 * A single guidance item.
 *
 * - `id` — stable identifier (caller-supplied; deterministic producers
 *   recommended).
 * - `sessionId` — the session the guidance was generated for.
 * - `kind` — one of the seven canonical kinds.
 * - `content` — human-readable text. Phrasing may reflect the narrative tone.
 * - `priority` — non-negative integer; higher = more important. Used by the
 *   UI to order guidance chips.
 * - `dismissible` — whether the user may dismiss the guidance.
 * - `dismissed` — whether the user has dismissed it.
 * - `triggeredAt` — epoch-millis from the RuntimeClock / `now` argument.
 */
export interface ExperienceGuidance {
  readonly id: string;
  readonly sessionId: string;
  readonly kind: GuidanceKind;
  readonly content: string;
  readonly priority: number;
  readonly dismissible: boolean;
  readonly dismissed: boolean;
  readonly triggeredAt: number;
}

/**
 * The GuidanceEngine PORT. Implementations are rule-based and deterministic:
 * identical `(session, journey, context, now)` inputs produce identical
 * guidance outputs.
 *
 * - `generate` — produce a fresh batch of guidance for the given session +
 *   journey + context. The returned items are also cached (per session) so
 *   `listActive` returns the cumulative set until dismissed.
 * - `dismiss` — mark a guidance item as `dismissed = true`. No-op if the item
 *   is not dismissible or does not exist.
 * - `listActive` — return all non-dismissed guidance items for the session,
 *   ordered by descending priority then ascending `triggeredAt`.
 */
export interface GuidanceEngine {
  generate(
    session: ExperienceSession,
    journey: ExperienceJourney | undefined,
    context: Readonly<Record<string, unknown>>,
    now: number,
  ): readonly ExperienceGuidance[];
  dismiss(guidanceId: string): void;
  listActive(sessionId: string): readonly ExperienceGuidance[];
}
