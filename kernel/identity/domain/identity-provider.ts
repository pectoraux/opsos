/**
 * @kernel/identity/domain/identity-provider — the IdentityProvider port.
 *
 * A port (interface only). Adapters live in `infrastructure/`. The provider's
 * responsibility is to exchange a presented token for a resolved `Principal`
 * (authenticate) and to mint a token from a principal (issueToken).
 *
 * Identity providers are typically EXTERNAL (OAuth/OIDC, SAML, corporate SSO).
 * The in-memory echo provider in `infrastructure/` exists only for kernel
 * self-test — it is NOT production auth.
 */

import type { Result, KernelError } from "@kernel/shared-kernel";
import type { Principal } from "./principal";

export interface IdentityProvider {
  /**
   * Validate a presented token and resolve the `Principal` it represents.
   * Returns `err(UnauthorizedError)` on invalid/expired tokens.
   */
  authenticate(token: string): Promise<Result<Principal, KernelError>>;

  /**
   * Mint a new token representing the given principal. The returned token can
   * later be exchanged via `authenticate`. Returns `err` on failure (e.g.
   * principal disabled).
   */
  issueToken(principal: Principal): Promise<Result<string, KernelError>>;
}
