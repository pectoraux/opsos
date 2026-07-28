/**
 * @kernel/application-runtime/authentication — authentication provider
 * abstraction.
 *
 * Applications configure providers. The kernel owns identity (the identity
 * module owns principals). Applications choose providers — they do not own
 * users. No login UI in M4.
 */

import type { AuthProviderConfig } from "../applications/application-manifest";

export interface ResolvedAuthProvider extends AuthProviderConfig {}

export interface ResolvedAuthentication {
  readonly enabledProviders: readonly ResolvedAuthProvider[];
  readonly primaryProvider?: ResolvedAuthProvider;
}

export function resolveAuthentication(
  providers: readonly AuthProviderConfig[]
): ResolvedAuthentication {
  const enabled = providers.filter((p) => p.enabled);
  return {
    enabledProviders: enabled,
    primaryProvider: enabled[0],
  };
}

/**
 * Port: an auth provider. The kernel's identity module owns the principal
 * model; an auth provider translates an external credential into a principal
 * claim. Implementations live in infrastructure (future milestone).
 */
export interface AuthenticationProvider {
  readonly kind: string;
  readonly providerId: string;
  authenticate(credential: unknown): Promise<{ readonly principalId: string; readonly claims: Readonly<Record<string, unknown>> } | null>;
}
