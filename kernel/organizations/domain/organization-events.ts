/**
 * @kernel/organizations/domain/organization-events — typed domain event payloads
 * for the Organization aggregate.
 *
 * Each payload is a plain readonly object tagged with an `eventType`
 * discriminator so the reducer can switch on it. The full union is
 * `OrganizationEventPayload`; the string union is `OrganizationEventType`.
 *
 * Determinism invariants (mirroring identity's convention):
 *   - Payloads carry NO timestamps — those live on `EventEnvelope.timestamp`
 *     (sourced from `ctx.clock.now()`). The reducer maps `event.timestamp` →
 *     `state.createdAt` / `state.updatedAt`.
 *   - Payloads carry NO version — that lives on `EventEnvelope.version` and is
 *     mirrored into `state.version` by the reducer.
 *   - The `eventType` discriminator duplicates the envelope's free-form
 *     `eventType` field (per the @kernel/events contract). Command handlers set
 *     both to the same value; the payload field is what the reducer narrows on.
 *
 * The Tenant is created implicitly with the Organization — its id is carried in
 * the `OrganizationCreated` payload (no separate TenantCreated event in this
 * bounded context; Tenant is a value projection of the Organization stream).
 */

import type { OrganizationId, TenantId } from "@kernel/shared-kernel";

/** Free-form settings map (extension point for higher layers). */
export type OrganizationSettings = Readonly<Record<string, unknown>>;

// ── Organization lifecycle ───────────────────────────────────────────────────

/**
 * Emitted when a new organization is created. The FIRST event on an
 * Organization stream — the reducer fully overwrites initial state from it.
 * Carries the implicitly-created `tenantId` (the data-isolation root).
 */
export interface OrganizationCreatedPayload {
  readonly eventType: "OrganizationCreated";
  readonly id: OrganizationId;
  readonly name: string;
  /** URL-friendly unique identifier. */
  readonly slug: string;
  /** The data-isolation root owned by this org (created implicitly). */
  readonly tenantId: TenantId;
  /** Optional initial settings; defaults to `{}`. */
  readonly settings?: OrganizationSettings;
}

/** Emitted when an organization is renamed (and optionally re-slugified). */
export interface OrganizationRenamedPayload {
  readonly eventType: "OrganizationRenamed";
  readonly name: string;
  /** New slug; `undefined` leaves the existing slug unchanged. */
  readonly slug?: string;
}

/** Emitted when an active organization is suspended (reversible). */
export interface OrganizationSuspendedPayload {
  readonly eventType: "OrganizationSuspended";
}

/** Emitted when a suspended organization is returned to active. */
export interface OrganizationReactivatedPayload {
  readonly eventType: "OrganizationReactivated";
}

/** Emitted when an organization is archived (terminal — no further lifecycle). */
export interface OrganizationArchivedPayload {
  readonly eventType: "OrganizationArchived";
}

/**
 * Emitted when an organization's settings are updated. Settings are MERGED
 * (shallow) into the existing settings map — keys not present in the payload
 * are left unchanged. To delete a key, a higher layer can set it to `null`
 * (interpretation is the consumer's responsibility).
 */
export interface OrganizationSettingsUpdatedPayload {
  readonly eventType: "OrganizationSettingsUpdated";
  readonly settings: OrganizationSettings;
}

// ── Discriminated union ──────────────────────────────────────────────────────

/** Discriminated union of every Organization domain event payload. */
export type OrganizationEventPayload =
  | OrganizationCreatedPayload
  | OrganizationRenamedPayload
  | OrganizationSuspendedPayload
  | OrganizationReactivatedPayload
  | OrganizationArchivedPayload
  | OrganizationSettingsUpdatedPayload;

/** String union of all Organization event types (discriminator values). */
export type OrganizationEventType = OrganizationEventPayload["eventType"];
