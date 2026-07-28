/**
 * @kernel/organizations/application — barrel.
 *
 * The application layer of the organizations bounded context. Contains:
 *   - `CommandContext` — the structural interface runtime's `ExecutionContext`
 *     satisfies, so callers pass it directly with no adapter.
 *   - Pure command handlers (createOrganization, addMember, inviteMember,
 *     removeMember, grantRole, revokeRole, suspendOrganization,
 *     reactivateOrganization, archiveOrganization, renameOrganization,
 *     updateOrganizationSettings).
 *
 * All command handlers are pure functions returning `Result<EventInput[],
 * KernelError>`. They perform NO I/O and call NO ports.
 */
export * from "./command-context";
export * from "./create-organization";
export * from "./add-member";
export * from "./grant-role";
export * from "./revoke-role";
export * from "./suspend-organization";
