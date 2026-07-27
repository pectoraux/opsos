/**
 * @kernel/organizations/domain/membership — the Membership aggregate
 * (event-sourced).
 *
 * A Membership binds a User (opaque `UserId` from shared-kernel — organizations
 * NEVER imports identity infrastructure) to an Organization with a set of
 * roles. Its stream id is the COMPOSITE `${organizationId}:${userId}` —
 * derived, not random — which guarantees exactly one Membership stream per
 * (org, user) pair.
 *
 * Lifecycle:
 *
 *      add     → active
 *      invite  → invited
 *      (invite accept: add on an invited stream) → active
 *      remove  → removed (terminal)
 *
 * Determinism invariants same as the Organization aggregate.
 */

import type {
  UserId,
  RoleId,
  OrganizationId,
  TenantId,
} from "@kernel/shared-kernel";
import type { AggregateReducer, EventEnvelope } from "@kernel/events";
import type {
  MembershipEventPayload,
  MemberAddedPayload,
  MemberInvitedPayload,
  MemberRoleGrantedPayload,
  MemberRoleRevokedPayload,
} from "./membership-events";
import { membershipIdOf } from "./membership-events";

/** Membership lifecycle. `removed` is terminal. */
export type MembershipStatus = "active" | "invited" | "removed";

/**
 * Immutable projection of a Membership's event stream. Every field is
 * derivable by replaying the stream from version 0.
 */
export interface MembershipState {
  /** Composite id: `${organizationId}:${userId}`. Derived, not random. */
  readonly id: string;
  readonly organizationId: OrganizationId;
  /** Opaque — organizations never imports identity infrastructure. */
  readonly userId: UserId;
  readonly tenantId: TenantId;
  /** Roles bound to this membership, in grant order. */
  readonly roleIds: readonly RoleId[];
  /** Lifecycle status. */
  readonly status: MembershipStatus;
  /** When the membership was first created (added or invited). */
  readonly joinedAt: number;
  /** Epoch millis — sourced from the most recent event's timestamp. */
  readonly updatedAt: number;
  /** Per-stream monotonic version (mirrors `EventEnvelope.version`). */
  readonly version: number;
}

/**
 * The Membership aggregate reducer. Pure: `(state, event) → state`.
 *
 * `aggregateType: "Membership"` is the canonical type tag used to build stream
 * ids (`Membership#${organizationId}:${userId}`).
 */
export const membershipReducer: AggregateReducer<
  MembershipState,
  MembershipEventPayload
> = {
  aggregateType: "Membership",

  initialState(id): MembershipState {
    // No events yet — placeholder state. `version: 0` means "no stream"; the
    // first `MemberAdded` or `MemberInvited` event overwrites every field.
    return {
      id: String(id),
      organizationId: id as OrganizationId, // placeholder — overwritten by first event
      userId: id as UserId, // placeholder — overwritten by first event
      tenantId: id as TenantId, // placeholder — overwritten by first event
      roleIds: [],
      status: "invited",
      joinedAt: 0,
      updatedAt: 0,
      version: 0,
    };
  },

  reduce(state: MembershipState, event: EventEnvelope<MembershipEventPayload>): MembershipState {
    const payload = event.payload;
    const ts = event.timestamp;
    const version = event.version;

    switch (payload.eventType) {
      case "MemberAdded": {
        const p: MemberAddedPayload = payload;
        return {
          id: membershipIdOf(p.organizationId, p.userId),
          organizationId: p.organizationId,
          userId: p.userId,
          tenantId: p.tenantId,
          roleIds: p.roleIds ?? [],
          status: "active",
          joinedAt: ts,
          updatedAt: ts,
          version,
        };
      }
      case "MemberInvited": {
        const p: MemberInvitedPayload = payload;
        return {
          id: membershipIdOf(p.organizationId, p.userId),
          organizationId: p.organizationId,
          userId: p.userId,
          tenantId: p.tenantId,
          roleIds: p.roleIds ?? [],
          status: "invited",
          joinedAt: ts,
          updatedAt: ts,
          version,
        };
      }
      case "MemberRoleGranted": {
        const p: MemberRoleGrantedPayload = payload;
        // Idempotent: if already present, do not duplicate.
        const roleIds = state.roleIds.includes(p.roleId)
          ? state.roleIds
          : [...state.roleIds, p.roleId];
        return { ...state, roleIds, updatedAt: ts, version };
      }
      case "MemberRoleRevoked": {
        const p: MemberRoleRevokedPayload = payload;
        const roleIds = state.roleIds.filter((r) => r !== p.roleId);
        return { ...state, roleIds, updatedAt: ts, version };
      }
      case "MemberRemoved": {
        return { ...state, status: "removed", updatedAt: ts, version };
      }
      default: {
        // Exhaustiveness guard — if a new event type is added without a case,
        // this branch fails to type-check.
        const _exhaustive: never = payload;
        void _exhaustive;
        return state;
      }
    }
  },
};
