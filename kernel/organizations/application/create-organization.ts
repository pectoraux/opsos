/**
 * @kernel/organizations/application/create-organization — the `createOrganization`
 * command.
 *
 * PURE function: `(state, command, ctx) → Result<EventInput[], KernelError>`.
 * Performs validation, builds the `OrganizationCreated` event input (which
 * carries the implicitly-created tenant id), returns it. Performs NO I/O and
 * calls NO ports. The caller is responsible for appending the returned events
 * to the organization's stream via the repository.
 *
 * Determinism:
 *   - `organizationId` = `command.organizationId ?? ctx.random.uuid()`
 *   - `tenantId`        = `command.tenantId ?? ctx.random.uuid()`
 *   - event timestamp   = `ctx.clock.now()`
 *   - NO `Date.now()` / `Math.random()`.
 *
 * The Tenant is created implicitly with the Organization — its id is carried
 * in the `OrganizationCreated` payload. There is no separate `createTenant`
 * command in this bounded context.
 */

import type {
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
import type { OrganizationState } from "../domain/organization";
import type {
  OrganizationCreatedPayload,
  OrganizationEventPayload,
  OrganizationSettings,
} from "../domain/organization-events";
import type { CommandContext } from "./command-context";

/** Command input for `createOrganization`. */
export interface CreateOrganizationCommand {
  /** Human-readable name. Must be non-empty. */
  readonly name: string;
  /** URL-friendly unique identifier (lowercase, alphanumeric, hyphen-separated). */
  readonly slug: string;
  /** Optional explicit organization id (else drawn from `ctx.random.uuid()`). */
  readonly organizationId?: OrganizationId;
  /** Optional explicit tenant id (else drawn from `ctx.random.uuid()`). */
  readonly tenantId?: TenantId;
  /** Optional initial settings map. */
  readonly settings?: OrganizationSettings;
}

/**
 * Slug validation rule: lowercase, alphanumeric, hyphen-separated; must start
 * and end with an alphanumeric character. Single-character slugs allowed.
 */
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * Register a new organization. Returns the `OrganizationCreated` event input.
 *
 * Pre-conditions:
 *   - `command.name` is non-empty (after trim).
 *   - `command.slug` is non-empty (after trim) and matches `SLUG_PATTERN`.
 *   - The organization stream must not yet exist (`state.version === 0`).
 *
 * Failure modes:
 *   - `ValidationError` — name missing/blank; slug missing/blank or malformed.
 *   - `IllegalStateError` — organization already exists.
 *
 * NOTE: slug uniqueness across organizations is NOT enforced here — it is an
 * invariant of the repository (the in-memory adapter's `findBySlug` lets the
 * caller pre-check; a real persisted adapter would enforce a unique index).
 * The pure command handler only validates the single stream it is given.
 */
export function createOrganization(
  state: OrganizationState,
  command: CreateOrganizationCommand,
  ctx: CommandContext
): Result<EventInput<OrganizationEventPayload>[], KernelError> {
  const name = command.name?.trim();
  if (!name) {
    return err(
      new ValidationError("name is required", [
        { field: "name", reason: "must be a non-empty string" },
      ])
    );
  }

  const slug = command.slug?.trim();
  if (!slug) {
    return err(
      new ValidationError("slug is required", [
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

  if (state.version > 0) {
    return err(
      new IllegalStateError(
        `Organization '${String(state.id)}' already exists (version ${state.version})`
      )
    );
  }

  const organizationId: OrganizationId =
    command.organizationId ?? asId<"OrganizationId">(ctx.random.uuid());
  const tenantId: TenantId =
    command.tenantId ?? asId<"TenantId">(ctx.random.uuid());
  const now = ctx.clock.now();

  const payload: OrganizationCreatedPayload = {
    eventType: "OrganizationCreated",
    id: organizationId,
    name,
    slug,
    tenantId,
    settings: command.settings,
  };

  const eventInput: EventInput<OrganizationEventPayload> = {
    aggregateId: organizationId,
    aggregateType: "Organization",
    eventType: "OrganizationCreated",
    timestamp: now,
    metadata: {
      correlationId: ctx.correlationId,
      principalId: ctx.principalId ?? undefined,
      tenantId,
      source: "organizations",
    },
    payload,
  };

  return ok([eventInput]);
}
