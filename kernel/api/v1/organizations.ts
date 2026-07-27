/**
 * @kernel/api/v1 — ORGANIZATIONS public surface (FROZEN).
 */
export type {
  Tenant,
  TenantStatus,
  OrganizationState,
  OrganizationStatus,
  MembershipState,
  MembershipStatus,
  TenancyContext,
  OrganizationRepository,
  MembershipRepository,
  OrganizationEventPayload,
  OrganizationEventType,
  MembershipEventPayload,
  MembershipEventType,
} from "@kernel/organizations";

export {
  organizationReducer,
  membershipReducer,
  tenantOf,
  membershipIdOf,
  createOrganization,
  addMember,
  inviteMember,
  removeMember,
  grantRole,
  // Renamed to avoid collision with identity's `revokeRole` in the v1 barrel.
  revokeRole as revokeMembershipRole,
  suspendOrganization,
  reactivateOrganization,
  archiveOrganization,
  renameOrganization,
  updateOrganizationSettings,
  InMemoryOrganizationRepository,
  InMemoryMembershipRepository,
} from "@kernel/organizations";
