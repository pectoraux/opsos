/**
 * @kernel/experience-runtime/application/create-session — use-case: create a
 * user session with context.
 *
 * Mints a fresh `ExperienceSession` with the supplied context (or the default
 * context), stamps `startedAt = lastActivityAt = now`, and registers it with
 * the `ExperienceRegistry`. The session is returned to the caller.
 *
 * Determinism rule: identical inputs + identical ports → identical outputs.
 * The caller supplies `now` and a deterministic session id.
 */

import type {
  ExperienceRegistry,
  ExperienceSession,
  SessionContext,
} from "../domain";
import { DEFAULT_SESSION_CONTEXT } from "../domain";

/** The input to `CreateSession.execute`. Pure data. */
export interface CreateSessionInput {
  readonly sessionId: string;
  readonly userId: string;
  readonly applicationId: string;
  /** Optional context; defaults to `DEFAULT_SESSION_CONTEXT`. */
  readonly context?: SessionContext;
  /** Optional journey id to link immediately (e.g. on session resume). */
  readonly journeyId?: string;
  /** Clock-sourced epoch-millis — used as `startedAt` + `lastActivityAt`. */
  readonly now: number;
}

/** The result of `CreateSession.execute`. */
export interface CreateSessionResult {
  readonly session: ExperienceSession;
}

/** The use-case PORT. */
export interface CreateSession {
  execute(input: CreateSessionInput): CreateSessionResult;
}

/**
 * Default implementation. Mints an immutable `ExperienceSession` and
 * registers it via `ExperienceRegistry.registerSession`.
 *
 * The minted session is always `active` (not `idle` / `terminated`) — idle is
 * a derived state computed by `effectiveSessionStatus(session, now)`, not a
 * stored status.
 */
export class CreateSessionUseCase implements CreateSession {
  constructor(private readonly registry: ExperienceRegistry) {}

  execute(input: CreateSessionInput): CreateSessionResult {
    const session: ExperienceSession = {
      id: input.sessionId,
      userId: input.userId,
      applicationId: input.applicationId,
      journeyId: input.journeyId,
      status: "active",
      context: input.context ?? DEFAULT_SESSION_CONTEXT,
      startedAt: input.now,
      lastActivityAt: input.now,
    };
    this.registry.registerSession(session);
    return { session };
  }
}
