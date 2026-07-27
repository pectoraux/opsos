/**
 * @kernel/organizations/domain/tenant — the Tenant value object.
 *
 * `TenantId` is the data-isolation boundary. Every kernel command (in every
 * bounded context) is scoped by it — it is the partition key for all data
 * owned by an organization.
 *
 * A Tenant is created implicitly when its parent Organization is created: the
 * `tenantId` is carried in the `OrganizationCreated` event payload (no separate
 * TenantCreated event in this bounded context). The Tenant is a value
 * PROJECTION of the Organization's event stream — its status mirrors the
 * parent org's reachability:
 *   - org `active`    → tenant `active`
 *   - org `suspended` → tenant `suspended`
 *   - org `archived`  → tenant `suspended` (the tenant stays isolated; the org
 *                       is just no longer reachable for writes)
 *
 * Pure data, no behaviour, no I/O.
 */

import type { TenantId, OrganizationId } from "@kernel/shared-kernel";

/** Lifecycle of a tenant (mirrors the parent org's reachability). */
export type TenantStatus = "active" | "suspended";

/**
 * Immutable Tenant value object. The data-isolation root for an organization.
 */
export interface Tenant {
  /** The data-isolation boundary — the partition key for all org data. */
  readonly id: TenantId;
  /** The owning organization (bidirectional reference). */
  readonly organizationId: OrganizationId;
  /** Lifecycle status — derived from the parent org's status. */
  readonly status: TenantStatus;
  /** Epoch millis — sourced from the parent org's `OrganizationCreated` event. */
  readonly createdAt: number;
}
