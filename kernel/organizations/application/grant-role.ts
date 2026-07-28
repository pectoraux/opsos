/**
 * @kernel/organizations/application/grant-role — the `grantRole` command.
 *
 * PURE function: `(state, command, ctx) → Result<EventInput[], KernelError>`.
 * Returns the `MemberRoleGranted` event input(s). NO I/O, NO ports.
 *
 * Idempotency: if the role is already bound to the membership, returns `ok([])`
 * (no events emitted). This is the same convention as identity's `assignRole`.
 *
 * Failure modes:
 *   - `NotFoundError` — membership does not exist (version 0).
 *   - `IllegalStateError` — membership is `removed` (terminal); or `invited`
 *     (roles may only be granted to active members — invited members must be
 *     added first via `addMember`).
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
  MemberRoleGrantedPayload,
} from "../domain/membership-events";
import type { CommandContext } from "./command-context";

/** Command input for `grantRole`. */
export interface GrantRoleCommand {
  /** The role to bind. */
  readonly roleId: RoleId;
}

/**
 * Grant a role to a membership. Idempotent: returns `ok([])` if the role is
 * already bound (no event emitted).
 */
export function grantRole(
  state: MembershipState,
  command: GrantRoleCommand,
  ctx: CommandContext
): Result<EventInput<MembershipEventPayload>[], KernelError> {
  if (state.version === 0) {
    return err(new NotFoundError("Membership", state.id));
  }
  if (state.status === "removed") {
    return err(
      new IllegalStateError(
        `Membership '${state.id}' is removed (terminal); cannot grant role '${command.roleId}'`
      )
    );
  }
  if (state.status === "invited") {
    return err(
      new IllegalStateError(
        `Membership '${state.id}' is invited; accept the invite (addMember) before granting roles`
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

  const payload: MemberRoleGrantedPayload = {
    eventType: "MemberRoleGranted",
    roleId: command.roleId,
  };
  return ok([
    {
      aggregateId: state.id,
      aggregateType: "Membership",
      eventType: "MemberRoleGranted",
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
