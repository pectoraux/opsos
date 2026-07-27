/**
 * @kernel/identity/application — barrel.
 *
 * The application layer of the identity bounded context. Contains:
 *   - `CommandContext` — the structural interface runtime's `ExecutionContext`
 *     satisfies, so callers pass it directly with no adapter.
 *   - Pure command handlers (registerUser, activateUser, suspendUser,
 *     reactivateUser, disableUser, updateProfile, assignRole, revokeRole).
 *   - `authenticateSession` use-case (delegates to the Authenticator port).
 *
 * All command handlers are pure functions returning `Result<EventInput[],
 * KernelError>`. They perform NO I/O and call NO ports.
 */
export * from "./command-context";
export * from "./register-user";
export * from "./activate-user";
export * from "./assign-role";
export * from "./authenticate-session";
