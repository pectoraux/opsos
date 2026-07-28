/**
 * @kernel/identity/infrastructure — barrel.
 *
 * Reference in-memory adapters for the identity bounded context. Suitable for
 * kernel self-test, the read-only inspector, and tests. NOT for production
 * persistence or production auth — real adapters (OIDC, SAML, persisted
 * EventStore, constant-time secret comparison) are installed later.
 *
 * The in-memory adapters are part of the public surface (consistent with how
 * `@kernel/events` exposes `InMemoryEventStore`).
 */
export {
  InMemoryUserRepository,
  type InMemoryUserRepositoryDeps,
} from "./in-memory-user-repository";
export { InMemoryIdentityProvider } from "./in-memory-identity-provider";
export {
  InMemoryAuthenticator,
  type InMemoryAuthenticatorDeps,
  type InMemoryCredentialRecord,
} from "./in-memory-authenticator";
