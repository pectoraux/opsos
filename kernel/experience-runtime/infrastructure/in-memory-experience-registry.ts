/**
 * @kernel/experience-runtime/infrastructure/in-memory-experience-registry —
 * the in-memory `ExperienceRegistry` implementation.
 *
 * Three plain `Map`s: sessions, journeys, intents. All write methods are
 * idempotent upserts by id. All list methods return stable insertion-order
 * snapshots; when called with a `userId`, they filter to that user. No
 * `Date.now()`, no `Math.random()`.
 */

import type {
  ExperienceIntent,
  ExperienceJourney,
  ExperienceRegistry,
  ExperienceSession,
  SessionUpdate,
} from "../domain";

export class InMemoryExperienceRegistry implements ExperienceRegistry {
  private readonly sessions = new Map<string, ExperienceSession>();
  private readonly journeys = new Map<string, ExperienceJourney>();
  private readonly intents = new Map<string, ExperienceIntent>();

  // ── Sessions ────────────────────────────────────────────────────────────
  registerSession(session: ExperienceSession): void {
    this.sessions.set(session.id, session);
  }

  getSession(id: string): ExperienceSession | undefined {
    return this.sessions.get(id);
  }

  listSessions(userId?: string): readonly ExperienceSession[] {
    const all = Array.from(this.sessions.values());
    return userId ? all.filter((s) => s.userId === userId) : all;
  }

  updateSession(
    id: string,
    updates: SessionUpdate,
    now: number,
  ): ExperienceSession | undefined {
    const existing = this.sessions.get(id);
    if (!existing) return undefined;
    // If a status transition to terminated happened and no explicit
    // lastActivityAt was supplied, use `terminatedAt` as the last activity
    // timestamp — keeps the invariant that a terminated session has a
    // coherent `terminatedAt` ≥ `lastActivityAt`.
    const terminateAt = updates.status === "terminated" ? updates.terminatedAt : undefined;
    const next: ExperienceSession = {
      id: existing.id,
      userId: existing.userId,
      applicationId: existing.applicationId,
      journeyId: updates.journeyId ?? existing.journeyId,
      status: updates.status ?? existing.status,
      context: updates.context ?? existing.context,
      startedAt: existing.startedAt,
      lastActivityAt:
        updates.lastActivityAt ??
        (terminateAt !== undefined ? terminateAt : existing.lastActivityAt),
      terminatedAt:
        updates.terminatedAt ??
        (existing.status === "terminated" ? existing.terminatedAt : undefined),
    };
    void now; // `now` reserved for future idle-stamping; not currently mutated.
    this.sessions.set(id, next);
    return next;
  }

  // ── Journeys ────────────────────────────────────────────────────────────
  registerJourney(journey: ExperienceJourney): void {
    this.journeys.set(journey.id, journey);
  }

  getJourney(id: string): ExperienceJourney | undefined {
    return this.journeys.get(id);
  }

  listJourneys(userId?: string): readonly ExperienceJourney[] {
    const all = Array.from(this.journeys.values());
    return userId ? all.filter((j) => j.userId === userId) : all;
  }

  // ── Intents ─────────────────────────────────────────────────────────────
  registerIntent(intent: ExperienceIntent): void {
    this.intents.set(intent.id, intent);
  }

  getIntent(id: string): ExperienceIntent | undefined {
    return this.intents.get(id);
  }

  listIntents(userId?: string): readonly ExperienceIntent[] {
    const all = Array.from(this.intents.values());
    return userId ? all.filter((i) => i.userId === userId) : all;
  }
}
