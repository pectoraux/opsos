/**
 * @kernel/organizations/domain/organization — the Organization aggregate
 * (event-sourced).
 *
 * An Organization is the tenancy root: it owns a Tenant (data-isolation
 * boundary) and a set of Memberships. Its state is a pure projection of the
 * events in its stream. The `organizationReducer` is the single authority on
 * how events fold into `OrganizationState`.
 *
 * Determinism invariants:
 *   - `createdAt` / `updatedAt` come from `event.timestamp` (clock-sourced).
 *   - `version` mirrors `event.version` (per-stream monotonic counter).
 *   - `settings` is merged (shallow) by `OrganizationSettingsUpdated`, never
 *     replaced wholesale by that event (only `OrganizationCreated` resets it).
 *   - The reducer is a pure function — no I/O, no time, no randomness.
 */

import type { OrganizationId, TenantId } from "@kernel/shared-kernel";
import type { AggregateReducer, EventEnvelope } from "@kernel/events";
import type {
  OrganizationEventPayload,
  OrganizationCreatedPayload,
  OrganizationRenamedPayload,
  OrganizationSettingsUpdatedPayload,
  OrganizationSettings,
} from "./organization-events";
import type { Tenant, TenantStatus } from "./tenant";

/** Organization lifecycle. `archived` is terminal. */
export type OrganizationStatus = "active" | "suspended" | "archived";

/**
 * Immutable projection of an Organization's event stream. Every field is
 * derivable by replaying the stream from version 0.
 */
export interface OrganizationState {
  /** The organization's stable, branded id. */
  readonly id: OrganizationId;
  /** Human-readable name. */
  readonly name: string;
  /** URL-friendly unique identifier. */
  readonly slug: string;
  /** Lifecycle status. */
  readonly status: OrganizationStatus;
  /** The data-isolation root owned by this org. */
  readonly tenantId: TenantId;
  /** Free-form settings map (extension point — merged, never replaced wholesale). */
  readonly settings: OrganizationSettings;
  /** Epoch millis — sourced from the `OrganizationCreated` event's timestamp. */
  readonly createdAt: number;
  /** Epoch millis — sourced from the most recent event's timestamp. */
  readonly updatedAt: number;
  /** Per-stream monotonic version (mirrors `EventEnvelope.version`). */
  readonly version: number;
}

/**
 * Derive the `Tenant` value object from an Organization's state. Pure
 * projection — the tenant status mirrors the parent org's reachability.
 *
 *   - org `active`    → tenant `active`
 *   - org `suspended` → tenant `suspended`
 *   - org `archived`  → tenant `suspended`
 */
export function tenantOf(org: OrganizationState): Tenant {
  const status: TenantStatus = org.status === "active" ? "active" : "suspended";
  return {
    id: org.tenantId,
    organizationId: org.id,
    status,
    createdAt: org.createdAt,
  };
}

/**
 * The Organization aggregate reducer. Pure: `(state, event) → state`.
 *
 * `aggregateType: "Organization"` is the canonical type tag used to build
 * stream ids (`Organization#${id}`) and to route events from the global stream.
 */
export const organizationReducer: AggregateReducer<
  OrganizationState,
  OrganizationEventPayload
> = {
  aggregateType: "Organization",

  initialState(id): OrganizationState {
    // No events yet — a placeholder state. `version: 0` means "no stream"; the
    // first `OrganizationCreated` event overwrites every field.
    return {
      id: id as OrganizationId,
      name: "",
      slug: "",
      status: "active",
      tenantId: id as TenantId, // placeholder — overwritten by OrganizationCreated
      settings: {},
      createdAt: 0,
      updatedAt: 0,
      version: 0,
    };
  },

  reduce(state: OrganizationState, event: EventEnvelope<OrganizationEventPayload>): OrganizationState {
    const payload = event.payload;
    const ts = event.timestamp;
    const version = event.version;

    switch (payload.eventType) {
      case "OrganizationCreated": {
        const p: OrganizationCreatedPayload = payload;
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          status: "active",
          tenantId: p.tenantId,
          settings: p.settings ?? {},
          createdAt: ts,
          updatedAt: ts,
          version,
        };
      }
      case "OrganizationRenamed": {
        const p: OrganizationRenamedPayload = payload;
        return {
          ...state,
          name: p.name,
          slug: p.slug !== undefined ? p.slug : state.slug,
          updatedAt: ts,
          version,
        };
      }
      case "OrganizationSuspended": {
        return { ...state, status: "suspended", updatedAt: ts, version };
      }
      case "OrganizationReactivated": {
        return { ...state, status: "active", updatedAt: ts, version };
      }
      case "OrganizationArchived": {
        return { ...state, status: "archived", updatedAt: ts, version };
      }
      case "OrganizationSettingsUpdated": {
        const p: OrganizationSettingsUpdatedPayload = payload;
        return {
          ...state,
          settings: { ...state.settings, ...p.settings },
          updatedAt: ts,
          version,
        };
      }
      default: {
        // Exhaustiveness guard — if a new event type is added without a case,
        // this branch fails to type-check.
        const _exhaustive: never = payload;
        void _exhaustive;
        return state;
      }
    }
  },
};
