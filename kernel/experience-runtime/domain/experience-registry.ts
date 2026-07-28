/**
 * @kernel/experience-runtime/domain/experience-registry — the
 * ExperienceRegistry PORT.
 *
 * The registry is the single source of truth for the three primary aggregates
 * of the experience runtime: sessions, journeys, and intents. It is a
 * read/write port (not just a query port) because sessions and journeys are
 * mutated through it (e.g. advancing a stage produces a new journey value
 * that replaces the old one).
 *
 * Implementations MUST be deterministic: identical `register` / `update`
 * calls against an empty registry produce identical state. No `Date.now()`,
 * no `Math.random()`.
 */

import type { ExperienceIntent } from "./experience-intent";
import type { ExperienceJourney } from "./experience-journey";
import type { ExperienceSession } from "./experience-session";

/**
 * The set of fields that may be patched on a session via `updateSession`.
 * Each field is optional; only the supplied fields are overwritten. All
 * fields are deep-copied into a new immutable session value by the
 * implementation.
 */
export interface SessionUpdate {
  readonly journeyId?: string;
  readonly status?: ExperienceSession["status"];
  readonly lastActivityAt?: number;
  readonly terminatedAt?: number;
  readonly context?: ExperienceSession["context"];
}

/**
 * The ExperienceRegistry PORT. All write methods are upserts (idempotent by
 * id). `listSessions` / `listJourneys` / `listIntents` return stable
 * insertion-order snapshots when called with no `userId`; when called with a
 * `userId`, they filter to that user.
 */
export interface ExperienceRegistry {
  // Sessions
  registerSession(session: ExperienceSession): void;
  getSession(id: string): ExperienceSession | undefined;
  listSessions(userId?: string): readonly ExperienceSession[];
  updateSession(
    id: string,
    updates: SessionUpdate,
    now: number,
  ): ExperienceSession | undefined;

  // Journeys
  registerJourney(journey: ExperienceJourney): void;
  getJourney(id: string): ExperienceJourney | undefined;
  listJourneys(userId?: string): readonly ExperienceJourney[];

  // Intents
  registerIntent(intent: ExperienceIntent): void;
  getIntent(id: string): ExperienceIntent | undefined;
  listIntents(userId?: string): readonly ExperienceIntent[];
}
