/**
 * @kernel/identity/application/register-user — the `registerUser` command.
 *
 * PURE function: `(state, command, ctx) → Result<EventInput[], KernelError>`.
 * Performs validation, builds the `UserRegistered` event input(s), returns
 * them. Performs NO I/O and calls NO ports. The caller is responsible for
 * appending the returned events to the user's stream via the repository.
 *
 * Determinism: the new `UserId` is `command.userId ?? ctx.random.uuid()`. The
 * event timestamp is `ctx.clock.now()`. No `Date.now()` / `Math.random()`.
 */

import type {
  UserId,
  OrganizationId,
  TenantId,
  Result,
  KernelError,
} from "@kernel/shared-kernel";
import {
  asId,
  ok,
  err,
  ValidationError,
  IllegalStateError,
} from "@kernel/shared-kernel";
import type { EventInput } from "@kernel/events";
import type { Credential } from "../domain/credential";
import type { UserState } from "../domain/user";
import type { UserRegisteredPayload, UserEventPayload } from "../domain/identity-events";
import type { CommandContext } from "./command-context";

/** Command input for `registerUser`. */
export interface RegisterUserCommand {
  /** Email or username. Must be non-empty. */
  readonly identifier: string;
  /** Optional human-readable name. */
  readonly displayName?: string;
  /** Optional initial credential (ref-only — never a raw secret). */
  readonly credential?: Credential;
  /** Opaque organisation reference. Identity never imports organisations. */
  readonly organizationId?: OrganizationId;
  /** Opaque tenancy boundary. */
  readonly tenantId?: TenantId;
  /**
   * Optional explicit user id. When omitted, a fresh UUID is drawn from
   * `ctx.random.uuid()` so registration is deterministic for a given seed.
   */
  readonly userId?: UserId;
}

/**
 * Register a new user. Returns the `UserRegistered` event input(s).
 *
 * Pre-conditions:
 *   - `command.identifier` is non-empty (after trim).
 *   - The user stream must not yet exist (`state.version === 0`).
 *
 * Failure modes:
 *   - `ValidationError` — identifier missing/blank.
 *   - `IllegalStateError` — user already exists.
 */
export function registerUser(
  state: UserState,
  command: RegisterUserCommand,
  ctx: CommandContext
): Result<EventInput<UserEventPayload>[], KernelError> {
  const trimmed = command.identifier?.trim();
  if (!trimmed) {
    return err(
      new ValidationError("identifier is required", [
        { field: "identifier", reason: "must be a non-empty string" },
      ])
    );
  }

  if (state.version > 0) {
    return err(
      new IllegalStateError(
        `User '${String(state.id)}' already exists (version ${state.version})`
      )
    );
  }

  const userId: UserId = command.userId ?? asId<"UserId">(ctx.random.uuid());
  const now = ctx.clock.now();

  const payload: UserRegisteredPayload = {
    eventType: "UserRegistered",
    id: userId,
    identifier: trimmed,
    displayName: command.displayName,
    credential: command.credential,
    organizationId: command.organizationId,
    tenantId: command.tenantId,
  };

  const eventInput: EventInput<UserEventPayload> = {
    aggregateId: userId,
    aggregateType: "User",
    eventType: "UserRegistered",
    timestamp: now,
    metadata: {
      correlationId: ctx.correlationId,
      principalId: ctx.principalId ?? undefined,
      tenantId: command.tenantId ?? ctx.tenantId ?? undefined,
      source: "identity",
    },
    payload,
  };

  return ok([eventInput]);
}
