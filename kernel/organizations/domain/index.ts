/**
 * @kernel/organizations/domain — barrel.
 *
 * Pure domain layer of the organizations bounded context. Depends ONLY on
 * `@kernel/shared-kernel` (identifiers, Result, errors, ports) and
 * `@kernel/events` (event-sourcing abstractions the aggregates plug into).
 *
 * Public surface (re-exported through `@kernel/organizations`):
 *   - Tenant: `Tenant`, `TenantStatus`
 *   - Organization: `OrganizationState`, `OrganizationStatus`, `organizationReducer`,
 *     `tenantOf`
 *   - Membership: `MembershipState`, `MembershipStatus`, `membershipReducer`
 *   - Events: `OrganizationEventPayload`, `OrganizationEventType`, plus individual
 *     payload types; `MembershipEventPayload`, `MembershipEventType`, plus
 *     individual payload types; `membershipIdOf` helper; `OrganizationSettings`
 *   - TenancyContext: `TenancyContext`
 *   - Ports: `OrganizationRepository`, `MembershipRepository`
 */
export * from "./tenant";
export * from "./organization-events";
export * from "./organization";
export * from "./membership-events";
export * from "./membership";
export * from "./tenancy-context";
export * from "./organization-repository";
export * from "./membership-repository";
