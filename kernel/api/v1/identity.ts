/**
 * @kernel/api/v1 — IDENTITY public surface (FROZEN).
 *
 * The contract every protocol / application depends on for authentication &
 * principal concerns. Re-exports ONLY the stable v1 types + the sanctioned
 * in-memory adapters used for kernel self-test. Internal implementation classes
 * that are NOT part of the v1 contract are intentionally excluded.
 *
 * Breaking changes to this file require a new API version (v2). Additive
 * changes (new optional fields, new exported types) are permitted within v1.
 */
export type {
  Principal,
  PrincipalType,
  PrincipalStatus,
  Role,
  RoleScope,
  Permission,
  PermissionEffect,
  Credential,
  CredentialKind,
  UserState,
  UserStatus,
  AuthSession,
  AuthSessionStatus,
  UserEventPayload,
  UserEventType,
  IdentityProvider,
  Authenticator,
  UserRepository,
} from "@kernel/identity";

// Command handlers (pure functions) — part of the v1 contract.
export {
  registerUser,
  activateUser,
  suspendUser,
  reactivateUser,
  disableUser,
  updateProfile,
  assignRole,
  revokeRole,
  authenticateSession,
} from "@kernel/identity";

export type {
  CommandContext,
  RegisterUserCommand,
  ActivateUserCommand,
  AssignRoleCommand,
} from "@kernel/identity";

// Sanctioned in-memory adapters (kernel self-test / inspector / tests only).
export {
  InMemoryUserRepository,
  InMemoryIdentityProvider,
  InMemoryAuthenticator,
} from "@kernel/identity";
