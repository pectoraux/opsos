/**
 * @kernel/identity/infrastructure/in-memory-authenticator — reference
 * in-memory Authenticator.
 *
 * ⚠️ NOT PRODUCTION AUTH. ⚠️
 *
 * Validates a revealed secret against a pre-registered credential map and, on
 * success, mints an `AuthSession` whose `issuedAt` / `expiresAt` come from the
 * injected `RuntimeClock` and whose `id` is a UUID from the injected
 * `RandomSource`. This is the only identity adapter that touches a revealed
 * secret — and even here, secrets live only in the test-fixture credential map,
 * never in the deterministic core or in events.
 *
 * Real deployments inject an `Authenticator` adapter that resolves the secret
 * via the `Secrets` port (from `@kernel/config`) and may hash/compare with a
 * constant-time routine.
 */

import type {
  Result,
  KernelError,
  RuntimeClock,
  RandomSource,
} from "@kernel/shared-kernel";
import { ok, err, UnauthorizedError, NotFoundError } from "@kernel/shared-kernel";
import type { CredentialKind } from "../domain/credential";
import type { Principal } from "../domain/principal";
import type { Authenticator, AuthSession } from "../domain/authenticator";

/** Default session TTL: 1 hour. */
const DEFAULT_TTL_MILLIS = 60 * 60 * 1000;

/**
 * A credential registered with the in-memory authenticator. The
 * `revealedSecret` is stored in PLAINTEXT — acceptable for an in-memory test
 * fixture, NEVER acceptable in a real adapter.
 */
export interface InMemoryCredentialRecord {
  /** Credential kind. Must match the kind passed to `authenticate`. */
  readonly kind: CredentialKind;
  /** The `secretRef` of the credential (same as on `Credential`). */
  readonly secretRef: string;
  /** The revealed secret the caller must present. */
  readonly revealedSecret: string;
  /** The principal this credential authenticates. */
  readonly principal: Principal;
}

/** Constructor deps for `InMemoryAuthenticator`. */
export interface InMemoryAuthenticatorDeps {
  /** Sanctioned source of time for `issuedAt` / `expiresAt`. REQUIRED. */
  readonly clock: RuntimeClock;
  /** Sanctioned source of randomness for session ids. REQUIRED. */
  readonly random: RandomSource;
  /** Session lifetime in milliseconds. Default: 1 hour. */
  readonly ttlMillis?: number;
  /** Pre-registered credentials. May also be added via `registerCredential`. */
  readonly credentials?: readonly InMemoryCredentialRecord[];
}

export class InMemoryAuthenticator implements Authenticator {
  private readonly credentials: Map<string, InMemoryCredentialRecord> = new Map();
  private readonly sessions: Map<string, AuthSession> = new Map();
  private readonly clock: RuntimeClock;
  private readonly random: RandomSource;
  private readonly ttlMillis: number;

  constructor(deps: InMemoryAuthenticatorDeps) {
    this.clock = deps.clock;
    this.random = deps.random;
    this.ttlMillis = deps.ttlMillis ?? DEFAULT_TTL_MILLIS;
    for (const c of deps.credentials ?? []) {
      this.credentials.set(c.secretRef, c);
    }
  }

  /** Register or replace a credential. */
  registerCredential(record: InMemoryCredentialRecord): void {
    this.credentials.set(record.secretRef, record);
  }

  /** Remove a credential. Subsequent auth attempts for it will fail. */
  revokeCredential(secretRef: string): void {
    this.credentials.delete(secretRef);
  }

  async authenticate(
    kind: CredentialKind,
    secretRef: string,
    revealedSecret: string
  ): Promise<Result<AuthSession, KernelError>> {
    const record = this.credentials.get(secretRef);
    if (!record) {
      return err(
        new UnauthorizedError(
          `unknown credential: kind=${kind}, secretRef=${secretRef}`
        )
      );
    }
    if (record.kind !== kind) {
      return err(
        new UnauthorizedError(
          `credential kind mismatch for secretRef=${secretRef}: expected ${record.kind}, got ${kind}`
        )
      );
    }
    // Test-fixture plain comparison. Real adapters MUST use a constant-time
    // compare against a stored hash (e.g. argon2id) — never plaintext.
    if (record.revealedSecret !== revealedSecret) {
      return err(
        new UnauthorizedError(`invalid secret for secretRef=${secretRef}`)
      );
    }
    if (record.principal.status !== "active") {
      return err(
        new UnauthorizedError(
          `principal '${record.principal.id}' is not active (status=${record.principal.status})`
        )
      );
    }

    const now = this.clock.now();
    const session: AuthSession = {
      id: this.random.uuid(),
      principalId: record.principal.id,
      tenantId: record.principal.tenantId,
      issuedAt: now,
      expiresAt: now + this.ttlMillis,
      status: "active",
    };
    this.sessions.set(session.id, session);
    return ok(session);
  }

  /** Look up a session by id. Returns `null` if not found. */
  getSession(sessionId: string): AuthSession | null {
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    // Lazily expire past-due sessions on read.
    if (s.status === "active" && this.clock.now() >= s.expiresAt) {
      const expired: AuthSession = { ...s, status: "expired" };
      this.sessions.set(sessionId, expired);
      return expired;
    }
    return s;
  }

  /**
   * Revoke a session. Subsequent `getSession` calls return the session with
   * `status: "revoked"`. Returns `err(NotFoundError)` if the session id is
   * unknown.
   */
  revoke(sessionId: string): Result<void, KernelError> {
    const s = this.sessions.get(sessionId);
    if (!s) {
      return err(new NotFoundError("AuthSession", sessionId));
    }
    this.sessions.set(sessionId, { ...s, status: "revoked" });
    return ok(undefined);
  }

  /**
   * Validate a session id: returns `ok(session)` if the session exists and is
   * active and not yet expired; otherwise `err(UnauthorizedError)`. Useful for
   * middleware that needs to gate on a session.
   */
  validate(sessionId: string): Result<AuthSession, KernelError> {
    const s = this.getSession(sessionId);
    if (!s) {
      return err(new UnauthorizedError(`unknown session: '${sessionId}'`));
    }
    if (s.status !== "active") {
      return err(
        new UnauthorizedError(`session '${sessionId}' is ${s.status}`)
      );
    }
    if (this.clock.now() >= s.expiresAt) {
      return err(
        new UnauthorizedError(`session '${sessionId}' has expired`)
      );
    }
    return ok(s);
  }
}

