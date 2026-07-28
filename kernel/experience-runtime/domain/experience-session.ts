/**
 * @kernel/experience-runtime/domain/experience-session — the ExperienceSession
 * + SessionContext value objects.
 *
 * A session is the user's live context within an application: their locale,
 * timezone, device class, accessibility needs, feature flags, and arbitrary
 * custom attributes. The session may optionally carry the id of the journey
 * the user is currently on. Every guidance generation, narrative tone
 * selection, and milestone evaluation reads from the session's context — that
 * is what makes an experience adaptive rather than uniform.
 *
 * Determinism rule: pure types + pure helpers — no `Date.now()`, no
 * `Math.random()`. All time flows through the `now` argument supplied by the
 * caller.
 */

/** The device class of a session. */
export type SessionDevice = "mobile" | "desktop" | "tablet" | "voice";

/**
 * Immutable session context. All fields are `readonly` and all sub-maps are
 * `Readonly<...>` so a session value is structurally immutable. New context
 * is produced only by creating a new session value.
 */
export interface SessionContext {
  readonly locale: string;
  readonly timezone: string;
  readonly device: SessionDevice;
  readonly accessibility: readonly string[];
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly customAttributes: Readonly<Record<string, unknown>>;
}

/** The lifecycle status of a session. */
export type SessionStatus = "active" | "idle" | "terminated";

/**
 * A single user session within an application.
 *
 * - `journeyId` — optional; the journey the user is currently on, if any.
 *   Updated by the `startJourney` / `advanceStage` use-cases.
 * - `lastActivityAt` — bumped on every interaction by the registry's
 *   `updateSession`. Idle detection (a session going `idle`) is a pure
 *   function of `now - lastActivityAt`.
 * - `terminatedAt` — set when the session transitions to `terminated`.
 */
export interface ExperienceSession {
  readonly id: string;
  readonly userId: string;
  readonly applicationId: string;
  readonly journeyId?: string;
  readonly status: SessionStatus;
  readonly context: SessionContext;
  readonly startedAt: number;
  readonly lastActivityAt: number;
  readonly terminatedAt?: number;
}

/**
 * Default idle threshold (millis). A session whose `now - lastActivityAt`
 * exceeds this is considered `idle` rather than `active`. Used by guidance
 * generation to nudge the user back into the journey.
 */
export const DEFAULT_SESSION_IDLE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Default session context — neutral locale/timezone, desktop device, no
 * accessibility needs, no feature flags, no custom attributes. Used by the
 * `createSession` use-case as a fallback.
 */
export const DEFAULT_SESSION_CONTEXT: SessionContext = {
  locale: "en-US",
  timezone: "UTC",
  device: "desktop",
  accessibility: [],
  featureFlags: {},
  customAttributes: {},
};

/**
 * Pure helper: is the session live (not terminated)? An idle session is still
 * live — only `terminated` is terminal.
 */
export function isSessionLive(session: ExperienceSession): boolean {
  return session.status !== "terminated";
}

/**
 * Pure helper: compute the effective session status at a given `now`. A
 * session recorded as `active` whose `now - lastActivityAt` exceeds the idle
 * threshold is reported as `idle`. `terminated` is always `terminated`.
 */
export function effectiveSessionStatus(
  session: ExperienceSession,
  now: number,
  idleMs: number = DEFAULT_SESSION_IDLE_MS,
): SessionStatus {
  if (session.status === "terminated") return "terminated";
  if (now - session.lastActivityAt >= idleMs) return "idle";
  return "active";
}

/**
 * Pure helper: read a feature flag from the session context. Returns `false`
 * when the flag is absent (matches the canonical OpsOS "absent flag = off"
 * semantics).
 */
export function featureFlag(
  session: ExperienceSession,
  key: string,
): boolean {
  return session.context.featureFlags[key] === true;
}
