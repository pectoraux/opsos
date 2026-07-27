/**
 * @kernel/organizations/application/revoke-role — the `revokeRole` command.
 *
 * PURE function: `(state, command, ctx) → Result<EventInput[], KernelError>`.
 * Returns the `MemberRoleRevoked` event input(s). NO I/O, NO ports.
 *
 * Idempotency: if the role is not currently bound to the membership, returns
 * `ok([])` (no events emitted). This is the same convention as identity's
 * `revokeRole`.
 *
 * Failure modes:
 *   - `NotFoundError` — membership does not exist (version 0).
 *   - `IllegalStateError` — membership is `removed` (terminal).
 *   - `ValidationError` — `roleId` missing.
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
import type { MembershipState } from "../domain/membership";
import type {
  MembershipEventPayload,
  MemberRoleRevokedPayload,
} from "../domain/membership-events";
import type { CommandContext } from "./command-context";

/** Command input for `revokeRole`. */
export interface RevokeRoleCommand {
  /** The role to remove. */
  readonly roleId: RoleId;
}

/**
 * Revoke a role from a membership. Idempotent: returns `ok([])` if the role
 * was not bound (no event emitted).
 */
export function revokeRole(
  state: MembershipState,
  command: RevokeRoleCommand,
  ctx: CommandContext
): Result<EventInput<MembershipEventPayload>[], KernelError> {
  if (state.version === 0) {
    return err(new NotFoundError("Membership", state.id));
  }
  if (state.status === "removed") {
    return err(
      new IllegalStateError(
        `Membership '${state.id}' is removed (terminal); cannot revoke role '${command.roleId}'`
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
  if (!state.roleIds.includes(command.roleId)) {
    // Idempotent: no event needed.
    return ok([]);
  }

  const payload: MemberRoleRevokedPayload = {
    eventType: "MemberRoleRevoked",
    roleId: command.roleId,
  };
  return ok([
    {
      aggregateId: state.id,
      aggregateType: "Membership",
      eventType: "MemberRoleRevoked",
      timestamp: ctx.clock.now(),
      metadata: {
        correlationId: ctx.correlationId,
        principalId: ctx.principalId ?? undefined,
        tenantId: state.tenantId,
        source: "organizations",
      },
      payload,
    },
  ]);
}
