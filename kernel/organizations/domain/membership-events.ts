/**
 * @kernel/organizations/domain/membership-events — typed domain event payloads
 * for the Membership aggregate.
 *
 * Same conventions as organization-events.ts: no timestamps on payloads, no
 * versions — those live on the `EventEnvelope`.
 *
 * Composite aggregate id: `${organizationId}:${userId}` — derived, not random.
 * This guarantees exactly one Membership stream per (org, user) pair. The
 * helper `membershipIdOf(orgId, userId)` produces the canonical string.
 */

import type {
  UserId,
  RoleId,
  OrganizationId,
  TenantId,
} from "@kernel/shared-kernel";

// ── Membership lifecycle ─────────────────────────────────────────────────────

/**
 * Emitted when a user is added to an org as an ACTIVE member. This is the
 * first event on a Membership stream when the user joins directly (no invite).
 */
export interface MemberAddedPayload {
  readonly eventType: "MemberAdded";
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
  readonly tenantId: TenantId;
  /** Initial role bindings, in grant order. May be empty. */
  readonly roleIds?: readonly RoleId[];
}

/**
 * Emitted when a user is INVITED to an org. The membership stream is created
 * in `invited` status; a later `MemberAdded` event transitions it to `active`
 * (when the invite is accepted).
 */
export interface MemberInvitedPayload {
  readonly eventType: "MemberInvited";
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
  readonly tenantId: TenantId;
  /** Proposed initial roles (may be empty). */
  readonly roleIds?: readonly RoleId[];
}

/** Emitted when a role is granted to a member. Idempotent at the reducer level. */
export interface MemberRoleGrantedPayload {
  readonly eventType: "MemberRoleGranted";
  readonly roleId: RoleId;
}

/** Emitted when a role is revoked from a member. */
export interface MemberRoleRevokedPayload {
  readonly eventType: "MemberRoleRevoked";
  readonly roleId: RoleId;
}

/** Emitted when a member is removed from an org. Terminal for the membership. */
export interface MemberRemovedPayload {
  readonly eventType: "MemberRemoved";
}

// ── Discriminated union ──────────────────────────────────────────────────────

/** Discriminated union of every Membership domain event payload. */
export type MembershipEventPayload =
  | MemberAddedPayload
  | MemberInvitedPayload
  | MemberRoleGrantedPayload
  | MemberRoleRevokedPayload
  | MemberRemovedPayload;

/** String union of all Membership event types (discriminator values). */
export type MembershipEventType = MembershipEventPayload["eventType"];

/**
 * Build the canonical composite membership id: `${organizationId}:${userId}`.
 * Pure helper — deterministic projection of (org, user) → membership stream id.
 */
export function membershipIdOf(
  organizationId: OrganizationId,
  userId: UserId
): string {
  return `${String(organizationId)}:${String(userId)}`;
}
