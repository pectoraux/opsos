/**
 * @kernel/organizations/application/suspend-organization — Organization lifecycle
 * + profile/settings commands.
 *
 * PURE functions: `(state, command, ctx) → Result<EventInput[], KernelError>`.
 * Each validates the current organization state and, if allowed, returns the
 * corresponding lifecycle event input. NO I/O, NO ports.
 *
 * State machine:
 *
 *      create     → active
 *      suspend    → suspended
 *      reactivate → active
 *      archive    → archived (terminal)
 *
 * Allowed transitions:
 *   - suspendOrganization:    active → suspended
 *   - reactivateOrganization: suspended → active
 *   - archiveOrganization:    active or suspended → archived (terminal)
 *   - renameOrganization:     any non-archived → (name/slug updated)
 *   - updateOrganizationSettings: any non-archived → (settings merged)
 *
 * The reducer is the authority on what each event does to state; these
 * handlers are the authority on whether an event MAY be emitted.
 */

import type {
  Result,
  KernelError,
} from "@kernel/shared-kernel";
import {
  ok,
  err,
  NotFoundError,
  IllegalStateError,
  ValidationError,
} from "@kernel/shared-kernel";
import type { EventInput } from "@kernel/events";
import type { OrganizationState } from "../domain/organization";
import type {
  OrganizationEventPayload,
  OrganizationRenamedPayload,
  OrganizationSettingsUpdatedPayload,
  OrganizationSettings,
  OrganizationSuspendedPayload,
  OrganizationReactivatedPayload,
  OrganizationArchivedPayload,
} from "../domain/organization-events";
import type { CommandContext } from "./command-context";

// ── suspend ──────────────────────────────────────────────────────────────────

/** Command input for `suspendOrganization`. */
export interface SuspendOrganizationCommand {}

/**
 * Suspend an active organization. The tenant is implicitly suspended (its
 * status mirrors the org's via `tenantOf`).
 */
export function suspendOrganization(
  state: OrganizationState,
  _command: SuspendOrganizationCommand,
  ctx: CommandContext
): Result<EventInput<OrganizationEventPayload>[], KernelError> {
  if (state.version === 0) {
    return err(new NotFoundError("Organization", String(state.id)));
  }
  if (state.status === "suspended") {
    return err(
      new IllegalStateError(`Organization '${state.id}' is already suspended`)
    );
  }
  if (state.status === "archived") {
    return err(
      new IllegalStateError(
        `Organization '${state.id}' is archived (terminal); cannot suspend`
      )
    );
  }
  return ok([lifecycleEvent(state, "OrganizationSuspended", ctx)]);
}

// ── reactivate ───────────────────────────────────────────────────────────────

/** Command input for `reactivateOrganization`. */
export interface ReactivateOrganizationCommand {}

/** Reactivate a suspended organization. */
export function reactivateOrganization(
  state: OrganizationState,
  _command: ReactivateOrganizationCommand,
  ctx: CommandContext
): Result<EventInput<OrganizationEventPayload>[], KernelError> {
  if (state.version === 0) {
    return err(new NotFoundError("Organization", String(state.id)));
  }
  if (state.status !== "suspended") {
    return err(
      new IllegalStateError(
        `Organization '${state.id}' is not suspended (status=${state.status}); cannot reactivate`
      )
    );
  }
  return ok([lifecycleEvent(state, "OrganizationReactivated", ctx)]);
}

// ── archive ──────────────────────────────────────────────────────────────────

/** Command input for `archiveOrganization`. */
export interface ArchiveOrganizationCommand {}

/** Permanently archive an organization. Terminal — no later lifecycle change. */
export function archiveOrganization(
  state: OrganizationState,
  _command: ArchiveOrganizationCommand,
  ctx: CommandContext
): Result<EventInput<OrganizationEventPayload>[], KernelError> {
  if (state.version === 0) {
    return err(new NotFoundError("Organization", String(state.id)));
  }
  if (state.status === "archived") {
    return err(
      new IllegalStateError(`Organization '${state.id}' is already archived`)
    );
  }
  return ok([lifecycleEvent(state, "OrganizationArchived", ctx)]);
}

// ── rename ───────────────────────────────────────────────────────────────────

/** Command input for `renameOrganization`. */
export interface RenameOrganizationCommand {
  /** New human-readable name. Must be non-empty. */
  readonly name: string;
  /** New slug; `undefined` leaves the existing slug unchanged. */
  readonly slug?: string;
}

/** Slug validation rule (same as `createOrganization`). */
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** Rename an organization (and optionally change its slug). */
export function renameOrganization(
  state: OrganizationState,
  command: RenameOrganizationCommand,
  ctx: CommandContext
): Result<EventInput<OrganizationEventPayload>[], KernelError> {
  if (state.version === 0) {
    return err(new NotFoundError("Organization", String(state.id)));
  }
  if (state.status === "archived") {
    return err(
      new IllegalStateError(
        `Organization '${state.id}' is archived (terminal); cannot rename`
      )
    );
  }
  const name = command.name?.trim();
  if (!name) {
    return err(
      new ValidationError("name is required", [
        { field: "name", reason: "must be a non-empty string" },
      ])
    );
  }
  let slug: string | undefined;
  if (command.slug !== undefined) {
    slug = command.slug.trim();
    if (!slug) {
      return err(
        new ValidationError("slug is required when provided", [
          { field: "slug", reason: "must be a non-empty string" },
        ])
      );
    }
    if (!SLUG_PATTERN.test(slug)) {
      return err(
        new ValidationError(`slug '${slug}' is invalid`, [
          {
            field: "slug",
            reason:
              "must be lowercase, alphanumeric, hyphen-separated; start and end alphanumeric",
          },
        ])
      );
    }
  }

  const payload: OrganizationRenamedPayload = {
    eventType: "OrganizationRenamed",
    name,
    slug,
  };
  return ok([
    {
      aggregateId: state.id,
      aggregateType: "Organization",
      eventType: "OrganizationRenamed",
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

// ── updateSettings ───────────────────────────────────────────────────────────

/** Command input for `updateOrganizationSettings`. */
export interface UpdateOrganizationSettingsCommand {
  /** Partial settings to merge into existing settings (shallow merge). */
  readonly settings: OrganizationSettings;
}

/** Update (merge) an organization's settings. */
export function updateOrganizationSettings(
  state: OrganizationState,
  command: UpdateOrganizationSettingsCommand,
  ctx: CommandContext
): Result<EventInput<OrganizationEventPayload>[], KernelError> {
  if (state.version === 0) {
    return err(new NotFoundError("Organization", String(state.id)));
  }
  if (state.status === "archived") {
    return err(
      new IllegalStateError(
        `Organization '${state.id}' is archived (terminal); cannot update settings`
      )
    );
  }
  if (!command.settings || typeof command.settings !== "object") {
    return err(
      new ValidationError("settings is required", [
        { field: "settings", reason: "must be a non-empty object" },
      ])
    );
  }

  const payload: OrganizationSettingsUpdatedPayload = {
    eventType: "OrganizationSettingsUpdated",
    settings: command.settings,
  };
  return ok([
    {
      aggregateId: state.id,
      aggregateType: "Organization",
      eventType: "OrganizationSettingsUpdated",
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

// ── private helpers ──────────────────────────────────────────────────────────

type SimpleLifecycleEventType =
  | "OrganizationSuspended"
  | "OrganizationReactivated"
  | "OrganizationArchived";

function lifecycleEvent(
  state: OrganizationState,
  eventType: SimpleLifecycleEventType,
  ctx: CommandContext
): EventInput<OrganizationEventPayload> {
  let payload: OrganizationEventPayload;
  switch (eventType) {
    case "OrganizationSuspended":
      payload = { eventType: "OrganizationSuspended" } satisfies OrganizationSuspendedPayload;
      break;
    case "OrganizationReactivated":
      payload = { eventType: "OrganizationReactivated" } satisfies OrganizationReactivatedPayload;
      break;
    case "OrganizationArchived":
      payload = { eventType: "OrganizationArchived" } satisfies OrganizationArchivedPayload;
      break;
  }
  return {
    aggregateId: state.id,
    aggregateType: "Organization",
    eventType,
    timestamp: ctx.clock.now(),
    metadata: {
      correlationId: ctx.correlationId,
      principalId: ctx.principalId ?? undefined,
      tenantId: state.tenantId,
      source: "organizations",
    },
    payload,
  };
}
