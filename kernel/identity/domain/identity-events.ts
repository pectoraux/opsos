/**
 * @kernel/identity/domain/identity-events — typed domain event payloads for the
 * User aggregate.
 *
 * Each payload is a plain readonly object tagged with an `eventType`
 * discriminator so the reducer can switch on it. The full union is
 * `UserEventPayload`; the string union is `UserEventType`.
 *
 * NOTE on timestamps: payloads carry NO timestamps — those live on the
 * `EventEnvelope.timestamp` (sourced from `ctx.clock.now()`). The reducer maps
 * `event.timestamp` → `state.createdAt` / `state.updatedAt`. This keeps the
 * deterministic invariant: same events + same clock = same state.
 *
 * NOTE on the `eventType` discriminator: it duplicates the envelope's
 * `eventType` field. The envelope field is a free-form string (the contract
 * from `@kernel/events`); the payload field is the discriminated-union tag the
 * reducer narrows on. Both are set to the same value by command handlers.
 */

import type { UserId, RoleId, OrganizationId, TenantId } from "@kernel/shared-kernel";
import type { Credential } from "./credential";

// ── User lifecycle ───────────────────────────────────────────────────────────

/** Emitted when a new user is registered (the first event on a User stream). */
export interface UserRegisteredPayload {
  readonly eventType: "UserRegistered";
  readonly id: UserId;
  /** Email or username — unique within the identity scope. */
  readonly identifier: string;
  readonly displayName?: string;
  /** Initial credential (optional — may be added later). */
  readonly credential?: Credential;
  /** Opaque organisation reference (identity never imports organisations). */
  readonly organizationId?: OrganizationId;
  /** Opaque tenancy boundary. */
  readonly tenantId?: TenantId;
}

/** Emitted when a pending/suspended user is activated. */
export interface UserActivatedPayload {
  readonly eventType: "UserActivated";
}

/** Emitted when an active user is temporarily suspended. */
export interface UserSuspendedPayload {
  readonly eventType: "UserSuspended";
}

/** Emitted when a suspended user is returned to active. */
export interface UserReactivatedPayload {
  readonly eventType: "UserReactivated";
}

/** Emitted when a user is permanently disabled (terminal state). */
export interface UserDisabledPayload {
  readonly eventType: "UserDisabled";
}

// ── Role bindings ────────────────────────────────────────────────────────────

/** Emitted when a role is bound to a user. Idempotent at the reducer level. */
export interface RoleAssignedPayload {
  readonly eventType: "RoleAssigned";
  readonly roleId: RoleId;
}

/** Emitted when a role is removed from a user. */
export interface RoleRevokedPayload {
  readonly eventType: "RoleRevoked";
  readonly roleId: RoleId;
}

// ── Profile ──────────────────────────────────────────────────────────────────

/** Emitted when a user's profile (display name) is updated. */
export interface ProfileUpdatedPayload {
  readonly eventType: "ProfileUpdated";
  /** New display name. `undefined` means "leave unchanged" (no-op event). */
  readonly displayName?: string;
}

// ── Discriminated union ──────────────────────────────────────────────────────

/** Discriminated union of every User domain event payload. */
export type UserEventPayload =
  | UserRegisteredPayload
  | UserActivatedPayload
  | UserSuspendedPayload
  | UserReactivatedPayload
  | UserDisabledPayload
  | RoleAssignedPayload
  | RoleRevokedPayload
  | ProfileUpdatedPayload;

/** String union of all User event types (discriminator values). */
export type UserEventType = UserEventPayload["eventType"];
