/**
 * @kernel/identity/domain/authenticator — the Authenticator port + AuthSession.
 *
 * A port (interface only). Adapters live in `infrastructure/`. The
 * Authenticator verifies a revealed secret against the secret referenced by a
 * `Credential.secretRef` and, on success, issues an `AuthSession`.
 *
 * The Authenticator is the only component permitted to read revealed secrets
 * (via the `Secrets` port from `@kernel/config`). Domain code never sees a
 * raw secret; command handlers only ever manipulate `secretRef` strings.
 */

import type {
  Result,
  KernelError,
  PrincipalId,
  TenantId,
} from "@kernel/shared-kernel";
import type { CredentialKind } from "./credential";

/** Lifecycle of an authenticated session. */
export type AuthSessionStatus = "active" | "expired" | "revoked";

/**
 * The result of a successful authentication: a bearer session bound to a
 * principal. Carries its own validity window (`issuedAt` / `expiresAt`) so the
 * kernel can reject stale sessions without consulting the provider again.
 */
export interface AuthSession {
  /** Session id (opaque token — the caller treats it as a bearer secret). */
  readonly id: string;
  /** The principal this session is bound to. */
  readonly principalId: PrincipalId;
  /** Opaque tenancy boundary carried from the principal, if any. */
  readonly tenantId?: TenantId;
  /** Epoch millis from the injected `RuntimeClock` at issuance. */
  readonly issuedAt: number;
  /** Epoch millis after which the session MUST be rejected as `expired`. */
  readonly expiresAt: number;
  /** Current lifecycle status. */
  readonly status: AuthSessionStatus;
}

export interface Authenticator {
  /**
   * Verify a revealed secret against the stored secret referenced by
   * `secretRef`, and on success issue a new `AuthSession`. On any failure
   * (unknown ref, kind mismatch, secret mismatch, principal disabled) returns
   * `err(UnauthorizedError)`.
   */
  authenticate(
    kind: CredentialKind,
    secretRef: string,
    revealedSecret: string
  ): Promise<Result<AuthSession, KernelError>>;
}
