/**
 * @kernel/identity/domain — barrel.
 *
 * Pure domain layer of the identity bounded context. Depends ONLY on
 * `@kernel/shared-kernel` and `@kernel/events` (for the event-sourcing
 * abstractions the User aggregate plugs into).
 *
 * Public surface (re-exported through `@kernel/identity`):
 *   - Principal: `Principal`, `PrincipalType`, `PrincipalStatus`
 *   - Role: `Role`, `RoleScope`, `Permission`, `PermissionEffect`
 *   - Credential: `Credential`, `CredentialKind`
 *   - User: `UserState`, `UserStatus`, `userReducer` (AggregateReducer)
 *   - Events: `UserEventPayload`, `UserEventType`, and individual payload types
 *   - Ports: `IdentityProvider`, `Authenticator`, `AuthSession`,
 *     `AuthSessionStatus`, `UserRepository`
 */
export * from "./principal";
export * from "./role";
export * from "./credential";
export * from "./identity-events";
export * from "./user";
export * from "./identity-provider";
export * from "./authenticator";
export * from "./user-repository";
