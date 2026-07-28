/**
 * @kernel/identity/domain/user — the User aggregate (event-sourced).
 *
 * The User is the only aggregate in the identity bounded context. Its state is
 * a pure projection of the events in its stream. The `userReducer` is the
 * single authority on how events fold into `UserState`.
 *
 * Determinism invariants honoured:
 *   - `createdAt` / `updatedAt` come from `event.timestamp` (clock-sourced).
 *   - `version` comes from `event.version` (per-stream monotonic counter).
 *   - `roleIds` ordering is preserved (append on assign, filter on revoke).
 *   - The reducer is a pure function — no I/O, no time, no randomness.
 */

import type {
  UserId,
  RoleId,
  OrganizationId,
  TenantId,
} from "@kernel/shared-kernel";
import type { Credential } from "./credential";
import type {
  UserEventPayload,
  UserRegisteredPayload,
  UserActivatedPayload,
  UserSuspendedPayload,
  UserReactivatedPayload,
  UserDisabledPayload,
  RoleAssignedPayload,
  RoleRevokedPayload,
  ProfileUpdatedPayload,
} from "./identity-events";
import type {
  AggregateReducer,
  EventEnvelope,
} from "@kernel/events";

/** Lifecycle of a User. `disabled` is terminal. */
export type UserStatus = "pending" | "active" | "suspended" | "disabled";

/**
 * Immutable projection of a User's event stream. Every field is derivable by
 * replaying the stream from version 0.
 */
export interface UserState {
  /** The user's stable, branded id. */
  readonly id: UserId;
  /** Email or username — unique within the identity scope. */
  readonly identifier: string;
  /** Lifecycle status. */
  readonly status: UserStatus;
  /** Optional human-readable name. */
  readonly displayName?: string;
  /** Optional credential (ref-only — never a raw secret). */
  readonly credential?: Credential;
  /** Roles bound to this user, in assignment order. */
  readonly roleIds: readonly RoleId[];
  /** Opaque organisation reference. Identity never imports organisations. */
  readonly organizationId?: OrganizationId;
  /** Opaque tenancy boundary. */
  readonly tenantId?: TenantId;
  /** Epoch millis — sourced from the `UserRegistered` event's timestamp. */
  readonly createdAt: number;
  /** Epoch millis — sourced from the most recent event's timestamp. */
  readonly updatedAt: number;
  /** Per-stream monotonic version (mirrors `EventEnvelope.version`). */
  readonly version: number;
}

/**
 * The User aggregate reducer. Pure: `(state, event) → state`.
 *
 * `aggregateType: "User"` is the canonical type tag used to build stream ids
 * (`User#${id}`) and to route events from the global stream.
 */
export const userReducer: AggregateReducer<UserState, UserEventPayload> = {
  aggregateType: "User",

  initialState(id): UserState {
    // No events yet — a placeholder state. `version: 0` means "no stream"; the
    // first `UserRegistered` event overwrites every field.
    return {
      id: id as UserId,
      identifier: "",
      status: "pending",
      roleIds: [],
      createdAt: 0,
      updatedAt: 0,
      version: 0,
    };
  },

  reduce(state: UserState, event: EventEnvelope<UserEventPayload>): UserState {
    const payload = event.payload;
    const ts = event.timestamp;
    const version = event.version;

    switch (payload.eventType) {
      case "UserRegistered": {
        const p: UserRegisteredPayload = payload;
        return {
          id: p.id,
          identifier: p.identifier,
          status: "pending",
          displayName: p.displayName,
          credential: p.credential,
          roleIds: [],
          organizationId: p.organizationId,
          tenantId: p.tenantId,
          createdAt: ts,
          updatedAt: ts,
          version,
        };
      }
      case "UserActivated": {
        const _p: UserActivatedPayload = payload;
        return { ...state, status: "active", updatedAt: ts, version };
      }
      case "UserSuspended": {
        const _p: UserSuspendedPayload = payload;
        return { ...state, status: "suspended", updatedAt: ts, version };
      }
      case "UserReactivated": {
        const _p: UserReactivatedPayload = payload;
        return { ...state, status: "active", updatedAt: ts, version };
      }
      case "UserDisabled": {
        const _p: UserDisabledPayload = payload;
        return { ...state, status: "disabled", updatedAt: ts, version };
      }
      case "RoleAssigned": {
        const p: RoleAssignedPayload = payload;
        // Idempotent: if already present, do not duplicate.
        const roleIds = state.roleIds.includes(p.roleId)
          ? state.roleIds
          : [...state.roleIds, p.roleId];
        return { ...state, roleIds, updatedAt: ts, version };
      }
      case "RoleRevoked": {
        const p: RoleRevokedPayload = payload;
        const roleIds = state.roleIds.filter((r) => r !== p.roleId);
        return { ...state, roleIds, updatedAt: ts, version };
      }
      case "ProfileUpdated": {
        const p: ProfileUpdatedPayload = payload;
        return {
          ...state,
          displayName: p.displayName !== undefined ? p.displayName : state.displayName,
          updatedAt: ts,
          version,
        };
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
