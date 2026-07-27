/**
 * @kernel/identity/application/assign-role — Role binding commands.
 *
 * PURE functions: `(state, command, ctx) → Result<EventInput[], KernelError>`.
 * Returns `RoleAssigned` / `RoleRevoked` event inputs. NO I/O, NO ports.
 *
 * `assignRole` is idempotent: if the role is already bound, it returns `ok([])`
 * (no events). `revokeRole` is likewise idempotent on a missing role.
 */

import type { RoleId, Result, KernelError } from "@kernel/shared-kernel";
import {
  ok,
  err,
  NotFoundError,
  IllegalStateError,
  ValidationError,
} from "@kernel/shared-kernel";
import type { EventInput } from "@kernel/events";
import type { UserState } from "../domain/user";
import type {
  UserEventPayload,
  RoleAssignedPayload,
  RoleRevokedPayload,
} from "../domain/identity-events";
import type { CommandContext } from "./command-context";

// ── assignRole ────────────────────────────────────────────────────────────────

/** Command input for `assignRole`. */
export interface AssignRoleCommand {
  /** The role to bind. */
  readonly roleId: RoleId;
}

/**
 * Bind a role to a user. Idempotent: returns `ok([])` if the role is already
 * bound (no event emitted). Rejects on disabled users and unknown streams.
 */
export function assignRole(
  state: UserState,
  command: AssignRoleCommand,
  ctx: CommandContext
): Result<EventInput<UserEventPayload>[], KernelError> {
  if (state.version === 0) {
    return err(new NotFoundError("User", String(state.id)));
  }
  if (state.status === "disabled") {
    return err(
      new IllegalStateError(
        `User '${state.id}' is disabled; cannot assign role '${command.roleId}'`
      )
    );
  }
  if (!command.roleId) {
    return err(
      new ValidationError("roleId is required", [
        { field: "roleId", reason: "must be a non-empty branded string" },
      ])
    );
  }
  if (state.roleIds.includes(command.roleId)) {
    // Idempotent: no event needed.
    return ok([]);
  }

  const payload: RoleAssignedPayload = {
    eventType: "RoleAssigned",
    roleId: command.roleId,
  };
  return ok([
    {
      aggregateId: state.id,
      aggregateType: "User",
      eventType: "RoleAssigned",
      timestamp: ctx.clock.now(),
      metadata: {
        correlationId: ctx.correlationId,
        principalId: ctx.principalId ?? undefined,
        tenantId: state.tenantId ?? ctx.tenantId ?? undefined,
        source: "identity",
      },
      payload,
    },
  ]);
}

// ── revokeRole ───────────────────────────────────────────────────────────────

/** Command input for `revokeRole`. */
export interface RevokeRoleCommand {
  /** The role to remove. */
  readonly roleId: RoleId;
}

/**
 * Remove a role from a user. Idempotent: returns `ok([])` if the role was not
 * bound. Rejects on unknown streams.
 */
export function revokeRole(
  state: UserState,
  command: RevokeRoleCommand,
  ctx: CommandContext
): Result<EventInput<UserEventPayload>[], KernelError> {
  if (state.version === 0) {
    return err(new NotFoundError("User", String(state.id)));
  }
  if (!command.roleId) {
    return err(
      new ValidationError("roleId is required", [
        { field: "roleId", reason: "must be a non-empty branded string" },
      ])
    );
  }
  if (!state.roleIds.includes(command.roleId)) {
    // Idempotent: no event needed.
    return ok([]);
  }

  const payload: RoleRevokedPayload = {
    eventType: "RoleRevoked",
    roleId: command.roleId,
  };
  return ok([
    {
      aggregateId: state.id,
      aggregateType: "User",
      eventType: "RoleRevoked",
      timestamp: ctx.clock.now(),
      metadata: {
        correlationId: ctx.correlationId,
        principalId: ctx.principalId ?? undefined,
        tenantId: state.tenantId ?? ctx.tenantId ?? undefined,
        source: "identity",
      },
      payload,
    },
  ]);
}

