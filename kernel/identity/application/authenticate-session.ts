/**
 * @kernel/identity/application/authenticate-session — the authenticate-session
 * use-case.
 *
 * Unlike the pure command handlers in this folder, this is a USE-CASE that
 * delegates to the `Authenticator` port (I/O). It exists to give callers a
 * single, well-named entry point for "verify a credential and obtain an
 * `AuthSession`" — wrapping the port so the call site does not depend on a
 * specific adapter.
 *
 * Determinism note: this use-case performs NO time/random work itself; the
 * injected `Authenticator` adapter is responsible for sourcing timestamps
 * from its own injected `RuntimeClock`. The kernel's `InMemoryAuthenticator`
 * honours that contract.
 */

import type { Result, KernelError } from "@kernel/shared-kernel";
import type { CredentialKind } from "../domain/credential";
import type { Authenticator, AuthSession } from "../domain/authenticator";

/** Deps for `authenticateSession`. */
export interface AuthenticateSessionDeps {
  /** The authenticator port implementation to delegate to. */
  readonly authenticator: Authenticator;
}

/** Input for `authenticateSession`. */
export interface AuthenticateSessionInput {
  /** The kind of credential being presented. */
  readonly kind: CredentialKind;
  /** The `secretRef` of the credential (looked up in the `Secrets` port). */
  readonly secretRef: string;
  /** The revealed secret the caller claims matches the stored one. */
  readonly revealedSecret: string;
}

/**
 * Authenticate a credential and produce an `AuthSession`.
 *
 * Returns `err` for any authentication failure (unknown credential, secret
 * mismatch, principal disabled). The error is always an `UnauthorizedError`
 * surfaced by the authenticator — callers MUST NOT branch on the message
 * (it may leak timing information in real adapters).
 */
export async function authenticateSession(
  deps: AuthenticateSessionDeps,
  input: AuthenticateSessionInput
): Promise<Result<AuthSession, KernelError>> {
  return deps.authenticator.authenticate(
    input.kind,
    input.secretRef,
    input.revealedSecret
  );
}
