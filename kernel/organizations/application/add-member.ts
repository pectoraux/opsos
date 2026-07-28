/**
 * @kernel/organizations/application/add-member — Membership lifecycle commands.
 *
 * PURE functions: `(state, command, ctx) → Result<EventInput[], KernelError>`.
 * Each validates the current membership state and, if allowed, returns the
 * corresponding lifecycle event input. NO I/O, NO ports.
 *
 * State machine:
 *
 *      add     → active     (MemberAdded)     [first event on a fresh stream]
 *      invite  → invited    (MemberInvited)   [first event on a fresh stream]
 *      accept-invite: add on an invited stream → active (MemberAdded)
 *      remove  → removed    (MemberRemoved)   [terminal]
 *
 * Allowed transitions:
 *   - addMember:        version 0 (no stream) → active
 *                       invited → active (invite acceptance)
 *   - inviteMember:     version 0 (no stream) → invited
 *   - removeMember:     active or invited → removed (terminal)
 *
 * The reducer is the authority on what each event does to state; these
 * handlers are the authority on whether an event MAY be emitted.
 *
 * NOTE on org existence: these handlers operate on the MembershipState only.
 * They DO NOT validate that the parent Organization exists or is active —
 * that is the caller's responsibility (a use-case layer would load both
 * streams). The pure handler's contract is "given this membership state,
 * may this event be emitted?".
 *
 * Determinism: composite id `${organizationId}:${userId}` is derived via
 * `membershipIdOf` — no random id needed. Timestamp via `ctx.clock.now()`.
 */

import type {
  UserId,
  RoleId,
  OrganizationId,
  TenantId,
  Result,
  KernelError,
} from "@kernel/shared-kernel";
import {
  ok,
  err,
  ValidationError,
  IllegalStateError,
} from "@kernel/shared-kernel";
import type { EventInput } from "@kernel/events";
import type { MembershipState } from "../domain/membership";
import type {
  MembershipEventPayload,
  MemberAddedPayload,
  MemberInvitedPayload,
} from "../domain/membership-events";
import { membershipIdOf } from "../domain/membership-events";
import type { CommandContext } from "./command-context";

// ── addMember ────────────────────────────────────────────────────────────────

/** Command input for `addMember`. */
export interface AddMemberCommand {
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
  /** The tenant boundary of the org (carried into the event payload). */
  readonly tenantId: TenantId;
  /** Initial roles to bind (may be empty). */
  readonly roleIds?: readonly RoleId[];
}

/**
 * Add a user to an org as an ACTIVE member. Idempotent on already-active
 * memberships is REJECTED (callers should check state first); invited
 * memberships are ACCEPTED (invite acceptance: invited → active).
 *
 * Failure modes:
 *   - `ValidationError` — required ids missing.
 *   - `IllegalStateError` — membership already active; or already removed
 *     (terminal).
 */
export function addMember(
  state: MembershipState,
  command: AddMemberCommand,
  ctx: CommandContext
): Result<EventInput<MembershipEventPayload>[], KernelError> {
  if (!command.organizationId) {
    return err(
      new ValidationError("organizationId is required", [
        { field: "organizationId", reason: "must be a non-empty branded string" },
      ])
    );
  }
  if (!command.userId) {
    return err(
      new ValidationError("userId is required", [
        { field: "userId", reason: "must be a non-empty branded string" },
      ])
    );
  }
  if (!command.tenantId) {
    return err(
      new ValidationError("tenantId is required", [
        { field: "tenantId", reason: "must be a non-empty branded string" },
      ])
    );
  }

  if (state.version > 0) {
    if (state.status === "active") {
      return err(
        new IllegalStateError(
          `Membership '${state.id}' is already active`
        )
      );
    }
    if (state.status === "removed") {
      return err(
        new IllegalStateError(
          `Membership '${state.id}' is removed (terminal); cannot re-add`
        )
      );
    }
    // status === "invited" → accept the invite (transition to active).
    // The composite id MUST match — otherwise the caller is mixing streams.
    const expectedId = membershipIdOf(command.organizationId, command.userId);
    if (state.id !== expectedId) {
      return err(
        new IllegalStateError(
          `Membership stream id mismatch: state.id='${state.id}' but command implies '${expectedId}'`
        )
      );
    }
  }

  const membershipId =
    state.version > 0
      ? state.id
      : membershipIdOf(command.organizationId, command.userId);

  const payload: MemberAddedPayload = {
    eventType: "MemberAdded",
    organizationId: command.organizationId,
    userId: command.userId,
    tenantId: command.tenantId,
    roleIds: command.roleIds,
  };

  return ok([
    {
      aggregateId: membershipId,
      aggregateType: "Membership",
      eventType: "MemberAdded",
      timestamp: ctx.clock.now(),
      metadata: {
        correlationId: ctx.correlationId,
        principalId: ctx.principalId ?? undefined,
        tenantId: command.tenantId,
        source: "organizations",
      },
      payload,
    },
  ]);
}

// ── inviteMember ─────────────────────────────────────────────────────────────

/** Command input for `inviteMember`. */
export interface InviteMemberCommand {
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
  readonly tenantId: TenantId;
  /** Proposed initial roles (may be empty). */
  readonly roleIds?: readonly RoleId[];
}

/**
 * Invite a user to an org (membership created in `invited` status). Rejects if
 * a membership stream already exists for the (org, user) pair.
 *
 * Failure modes:
 *   - `ValidationError` — required ids missing.
 *   - `IllegalStateError` — membership already exists (any status).
 */
export function inviteMember(
  state: MembershipState,
  command: InviteMemberCommand,
  ctx: CommandContext
): Result<EventInput<MembershipEventPayload>[], KernelError> {
  if (!command.organizationId) {
    return err(
      new ValidationError("organizationId is required", [
        { field: "organizationId", reason: "must be a non-empty branded string" },
      ])
    );
  }
  if (!command.userId) {
    return err(
      new ValidationError("userId is required", [
        { field: "userId", reason: "must be a non-empty branded string" },
      ])
    );
  }
  if (!command.tenantId) {
    return err(
      new ValidationError("tenantId is required", [
        { field: "tenantId", reason: "must be a non-empty branded string" },
      ])
    );
  }

  if (state.version > 0) {
    return err(
      new IllegalStateError(
        `Membership '${state.id}' already exists (status=${state.status}); cannot invite`
      )
    );
  }

  const membershipId = membershipIdOf(command.organizationId, command.userId);

  const payload: MemberInvitedPayload = {
    eventType: "MemberInvited",
    organizationId: command.organizationId,
    userId: command.userId,
    tenantId: command.tenantId,
    roleIds: command.roleIds,
  };

  return ok([
    {
      aggregateId: membershipId,
      aggregateType: "Membership",
      eventType: "MemberInvited",
      timestamp: ctx.clock.now(),
      metadata: {
        correlationId: ctx.correlationId,
        principalId: ctx.principalId ?? undefined,
        tenantId: command.tenantId,
        source: "organizations",
      },
      payload,
    },
  ]);
}

// ── removeMember ─────────────────────────────────────────────────────────────

/** Command input for `removeMember`. */
export interface RemoveMemberCommand {}

/**
 * Remove a member from an org. Terminal — no later lifecycle change is
 * allowed on the membership stream.
 *
 * Failure modes:
 *   - `NotFoundError` (via IllegalStateError here for consistency with the
 *     membership stream contract) — membership does not exist (version 0).
 *   - `IllegalStateError` — membership already removed (terminal).
 */
export function removeMember(
  state: MembershipState,
  _command: RemoveMemberCommand,
  ctx: CommandContext
): Result<EventInput<MembershipEventPayload>[], KernelError> {
  if (state.version === 0) {
    return err(
      new IllegalStateError(
        `Membership '${state.id}' does not exist (version 0); cannot remove`
      )
    );
  }
  if (state.status === "removed") {
    return err(
      new IllegalStateError(`Membership '${state.id}' is already removed (terminal)`)
    );
  }

  return ok([
    {
      aggregateId: state.id,
      aggregateType: "Membership",
      eventType: "MemberRemoved",
      timestamp: ctx.clock.now(),
      metadata: {
        correlationId: ctx.correlationId,
        principalId: ctx.principalId ?? undefined,
        tenantId: state.tenantId,
        source: "organizations",
      },
      payload: { eventType: "MemberRemoved" },
    },
  ]);
}
