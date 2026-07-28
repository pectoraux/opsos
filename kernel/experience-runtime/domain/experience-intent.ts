/**
 * @kernel/experience-runtime/domain/experience-intent — the ExperienceIntent
 * value object.
 *
 * `ExperienceIntent` captures WHAT a user is trying to achieve inside an
 * application at a given moment. It is the seed of every journey: a journey
 * exists to fulfill an intent. Intents are deliberately coarse-grained and
 * application-agnostic — "navigate to a screen", "act on an item", "inquire
 * about state", "configure a setting", "onboard onto a feature", "resolve an
 * issue", "explore the surface".
 *
 * Determinism rule: pure types + pure helpers — no `Date.now()`, no
 * `Math.random()`. All time flows through the `now` argument supplied by the
 * caller.
 */

import type { UnknownRecord } from "@kernel/shared-kernel";

/**
 * The canonical experience-intent types. OpsOS applications classify every
 * user intent into one of these seven buckets so that journey templates,
 * narrative tones, and guidance rules can be reused across applications.
 */
export type ExperienceIntentType =
  | "navigate"
  | "act"
  | "inquire"
  | "configure"
  | "onboard"
  | "resolve"
  | "explore";

/** The lifecycle status of an intent. */
export type ExperienceIntentStatus =
  | "active"
  | "fulfilled"
  | "abandoned"
  | "escalated";

/**
 * A single user intent within an application.
 *
 * - `id` — stable identifier (caller-supplied; deterministic producers
 *   recommended).
 * - `userId` / `applicationId` — scoping.
 * - `type` — one of the seven canonical intent types.
 * - `target` — application-specific target identifier (a route, an entity id,
 *   a setting key, …) the intent is directed at.
 * - `payload` — opaque, application-specific parameters.
 * - `priority` — non-negative integer; higher = more urgent. Used by guidance
 *   generation to order hints.
 * - `status` — lifecycle.
 * - `createdAt` — epoch-millis from the RuntimeClock / `now` argument.
 */
export interface ExperienceIntent {
  readonly id: string;
  readonly userId: string;
  readonly applicationId: string;
  readonly type: ExperienceIntentType;
  readonly target: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly priority: number;
  readonly status: ExperienceIntentStatus;
  readonly createdAt: number;
}

/** The default priority for a freshly declared intent. */
export const DEFAULT_INTENT_PRIORITY = 1;

/**
 * Default intent-type → suggested initial journey stage name. Used by the
 * `startJourney` use-case to seed the first stage when no explicit stages are
 * supplied. Pure data — no I/O.
 */
export const INTENT_TYPE_DEFAULT_STAGE: Readonly<
  Record<ExperienceIntentType, string>
> = {
  navigate: "navigate",
  act: "perform",
  inquire: "inspect",
  configure: "configure",
  onboard: "introduce",
  resolve: "diagnose",
  explore: "browse",
};

/**
 * Default intent-type → suggested narrative tone. Pure data — no I/O.
 */
export const INTENT_TYPE_DEFAULT_TONE: Readonly<
  Record<ExperienceIntentType, "professional" | "friendly" | "concise" | "detailed" | "guided">
> = {
  navigate: "concise",
  act: "professional",
  inquire: "concise",
  configure: "detailed",
  onboard: "guided",
  resolve: "professional",
  explore: "friendly",
};

/** Helper: an UnknownRecord alias used by intent payloads. */
export type IntentPayload = UnknownRecord;
