/**
 * @kernel/identity/infrastructure/in-memory-identity-provider — echo provider.
 *
 * ⚠️ NOT PRODUCTION AUTH. ⚠️
 *
 * This is a self-test adapter that lets the kernel demonstrate an end-to-end
 * authentication flow without depending on an external IdP (OAuth/OIDC/SAML).
 * It is intentionally trivial: it keeps an in-memory map of `token → Principal`
 * and, when a token is not in the map, it attempts to parse an echo token of
 * the form `"user:<userId>"` or `"service:<id>"` into a synthetic Principal.
 *
 * Real deployments inject a real `IdentityProvider` adapter (e.g. an OIDC
 * client) — never this class.
 */

import type { Result, KernelError } from "@kernel/shared-kernel";
import { ok, err, asId, UnauthorizedError } from "@kernel/shared-kernel";
import type { Principal } from "../domain/principal";
import type { PrincipalId, UserId } from "@kernel/shared-kernel";
import type { IdentityProvider } from "../domain/identity-provider";

/**
 * In-memory echo IdentityProvider. Instance-scoped state only — no module-level
 * mutable singletons.
 */
export class InMemoryIdentityProvider implements IdentityProvider {
  private readonly tokens: Map<string, Principal> = new Map();

  /**
   * Register (or replace) a token → principal mapping. Lets tests pre-seed
   * known tokens for deterministic authentication.
   */
  registerPrincipal(token: string, principal: Principal): void {
    this.tokens.set(token, principal);
  }

  /**
   * Revoke a previously-registered token. Subsequent `authenticate` calls with
   * that token fall through to the echo parser (or fail).
   */
  revokeToken(token: string): void {
    this.tokens.delete(token);
  }

  async authenticate(
    token: string
  ): Promise<Result<Principal, KernelError>> {
    if (!token) {
      return err(new UnauthorizedError("token is required"));
    }

    // Exact-match pre-registered principal.
    const known = this.tokens.get(token);
    if (known) {
      if (known.status !== "active") {
        return err(
          new UnauthorizedError(
            `principal '${known.id}' is not active (status=${known.status})`
          )
        );
      }
      return ok(known);
    }

    // Echo parser: "user:<userId>" → synthetic user principal.
    // FOR KERNEL SELF-TEST ONLY — never accept this in production auth.
    if (token.startsWith("user:")) {
      const rawId = token.slice("user:".length);
      if (!rawId) {
        return err(new UnauthorizedError("echo token 'user:' requires a userId"));
      }
      const userId = asId<"UserId">(rawId);
      const principal: Principal = {
        id: asId<"PrincipalId">(rawId),
        type: "user",
        userId,
        scopes: [],
        status: "active",
      };
      return ok(principal);
    }

    // Echo parser: "service:<id>" → synthetic service principal.
    if (token.startsWith("service:")) {
      const rawId = token.slice("service:".length);
      if (!rawId) {
        return err(
          new UnauthorizedError("echo token 'service:' requires an id")
        );
      }
      const principal: Principal = {
        id: asId<"PrincipalId">(rawId),
        type: "service",
        scopes: [],
        status: "active",
      };
      return ok(principal);
    }

    return err(new UnauthorizedError(`unknown token: '${token}'`));
  }

  async issueToken(
    principal: Principal
  ): Promise<Result<string, KernelError>> {
    if (principal.status !== "active") {
      return err(
        new UnauthorizedError(
          `principal '${principal.id}' is not active (status=${principal.status}); cannot issue token`
        )
      );
    }
    // Echo round-trip: the token re-encodes the principal type + id, so
    // `authenticate(issueToken(p))` recovers an equivalent principal.
    const token =
      principal.type === "user"
        ? `user:${principal.userId ?? principal.id}`
        : `service:${principal.id}`;
    this.tokens.set(token, principal);
    return ok(token);
  }
}
