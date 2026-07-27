/**
 * @kernel/identity/application/activate-user — User lifecycle commands.
 *
 * PURE functions: `(state, command, ctx) → Result<EventInput[], KernelError>`.
 * Each validates the current state and, if allowed, returns the corresponding
 * lifecycle event input. NO I/O, NO ports.
 *
 * State machine:
 *
 *      register → pending
 *      activate → active
 *      suspend  → suspended
 *      reactivate → active
 *      disable  → disabled (terminal)
 *
 * Allowed transitions:
 *   - activate:     pending → active
 *   - suspend:      active → suspended
 *   - reactivate:   suspended → active
 *   - disable:      any non-disabled → disabled
 *
 * The reducer is the authority on what each event does to state; these
 * handlers are the authority on whether an event MAY be emitted.
 */

import type {
  Result,
  KernelError,
} from "@kernel/shared-kernel";
import { ok, err, NotFoundError, IllegalStateError } from "@kernel/shared-kernel";
import type { EventInput } from "@kernel/events";
import type { UserState } from "../domain/user";
import type {
  UserEventPayload,
  UserActivatedPayload,
  UserSuspendedPayload,
  UserReactivatedPayload,
  UserDisabledPayload,
  ProfileUpdatedPayload,
} from "../domain/identity-events";
import type { CommandContext } from "./command-context";

// ── activate ─────────────────────────────────────────────────────────────────

/** Command input for `activateUser`. */
export interface ActivateUserCommand {}

/**
 * Activate a pending user. Idempotent on already-active users is REJECTED
 * (callers should check state first); suspended users must use `reactivateUser`.
 */
export function activateUser(
  state: UserState,
  _command: ActivateUserCommand,
  ctx: CommandContext
): Result<EventInput<UserEventPayload>[], KernelError> {
  if (state.version === 0) {
    return err(new NotFoundError("User", String(state.id)));
  }
  if (state.status === "active") {
    return err(new IllegalStateError(`User '${state.id}' is already active`));
  }
  if (state.status === "suspended") {
    return err(
      new IllegalStateError(
        `User '${state.id}' is suspended; use reactivateUser instead`
      )
    );
  }
  if (state.status === "disabled") {
    return err(
      new IllegalStateError(
        `User '${state.id}' is disabled (terminal); cannot activate`
      )
    );
  }
  // status === "pending"
  return ok([lifecycleEvent(state, "UserActivated", ctx)]);
}

// ── suspend ──────────────────────────────────────────────────────────────────

/** Command input for `suspendUser`. */
export interface SuspendUserCommand {}

/** Suspend an active user (reversible via `reactivateUser`). */
export function suspendUser(
  state: UserState,
  _command: SuspendUserCommand,
  ctx: CommandContext
): Result<EventInput<UserEventPayload>[], KernelError> {
  if (state.version === 0) {
    return err(new NotFoundError("User", String(state.id)));
  }
  if (state.status !== "active") {
    return err(
      new IllegalStateError(
        `User '${state.id}' is not active (status=${state.status}); cannot suspend`
      )
    );
  }
  return ok([lifecycleEvent(state, "UserSuspended", ctx)]);
}

// ── reactivate ───────────────────────────────────────────────────────────────

/** Command input for `reactivateUser`. */
export interface ReactivateUserCommand {}

/** Reactivate a suspended user. */
export function reactivateUser(
  state: UserState,
  _command: ReactivateUserCommand,
  ctx: CommandContext
): Result<EventInput<UserEventPayload>[], KernelError> {
  if (state.version === 0) {
    return err(new NotFoundError("User", String(state.id)));
  }
  if (state.status !== "suspended") {
    return err(
      new IllegalStateError(
        `User '${state.id}' is not suspended (status=${state.status}); cannot reactivate`
      )
    );
  }
  return ok([lifecycleEvent(state, "UserReactivated", ctx)]);
}

// ── disable ──────────────────────────────────────────────────────────────────

/** Command input for `disableUser`. */
export interface DisableUserCommand {}

/** Permanently disable a user. Terminal — no later lifecycle change is allowed. */
export function disableUser(
  state: UserState,
  _command: DisableUserCommand,
  ctx: CommandContext
): Result<EventInput<UserEventPayload>[], KernelError> {
  if (state.version === 0) {
    return err(new NotFoundError("User", String(state.id)));
  }
  if (state.status === "disabled") {
    return err(new IllegalStateError(`User '${state.id}' is already disabled`));
  }
  return ok([lifecycleEvent(state, "UserDisabled", ctx)]);
}

// ── updateProfile ────────────────────────────────────────────────────────────

/** Command input for `updateProfile`. */
export interface UpdateProfileCommand {
  /** New display name. `undefined` leaves the field unchanged. */
  readonly displayName?: string;
}

/** Update a user's profile (display name). No-op if `displayName` is undefined. */
export function updateProfile(
  state: UserState,
  command: UpdateProfileCommand,
  ctx: CommandContext
): Result<EventInput<UserEventPayload>[], KernelError> {
  if (state.version === 0) {
    return err(new NotFoundError("User", String(state.id)));
  }
  if (state.status === "disabled") {
    return err(
      new IllegalStateError(
        `User '${state.id}' is disabled; cannot update profile`
      )
    );
  }
  if (command.displayName === undefined) {
    // No-op: emit nothing.
    return ok([]);
  }
  const payload: ProfileUpdatedPayload = {
    eventType: "ProfileUpdated",
    displayName: command.displayName,
  };
  return ok([
    {
      aggregateId: state.id,
      aggregateType: "User",
      eventType: "ProfileUpdated",
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

// ── private helpers ──────────────────────────────────────────────────────────

type SimpleLifecycleEventType =
  | "UserActivated"
  | "UserSuspended"
  | "UserReactivated"
  | "UserDisabled";

function lifecycleEvent(
  state: UserState,
  eventType: SimpleLifecycleEventType,
  ctx: CommandContext
): EventInput<UserEventPayload> {
  let payload: UserEventPayload;
  switch (eventType) {
    case "UserActivated":
      payload = { eventType: "UserActivated" } satisfies UserActivatedPayload;
      break;
    case "UserSuspended":
      payload = { eventType: "UserSuspended" } satisfies UserSuspendedPayload;
      break;
    case "UserReactivated":
      payload = { eventType: "UserReactivated" } satisfies UserReactivatedPayload;
      break;
    case "UserDisabled":
      payload = { eventType: "UserDisabled" } satisfies UserDisabledPayload;
      break;
  }
  return {
    aggregateId: state.id,
    aggregateType: "User",
    eventType,
    timestamp: ctx.clock.now(),
    metadata: {
      correlationId: ctx.correlationId,
      principalId: ctx.principalId ?? undefined,
      tenantId: state.tenantId ?? ctx.tenantId ?? undefined,
      source: "identity",
    },
    payload,
  };
}
