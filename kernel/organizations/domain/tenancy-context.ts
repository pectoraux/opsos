/**
 * @kernel/organizations/domain/tenancy-context — the scope of a kernel command.
 *
 * Answers "in which org/tenant is the actor acting, on whose behalf?". Every
 * kernel command (in every bounded context) is scoped by a TenancyContext:
 *   - `tenantId` is the data-isolation boundary (the partition key).
 *   - `organizationId` is the tenancy root that owns the tenant.
 *   - `principalId` is the acting principal (opaque, from identity —
 *     organizations never imports identity infrastructure, only the branded
 *     `PrincipalId` type from shared-kernel).
 *   - `correlationId` threads through to event metadata for cross-cutting
 *     trace linkage.
 *
 * Built by the runtime from the resolved Principal + the chosen organization.
 * Pure data, no behaviour, no I/O.
 */

import type {
  TenantId,
  OrganizationId,
  PrincipalId,
} from "@kernel/shared-kernel";

export interface TenancyContext {
  /** The data-isolation boundary — partition key for all org data. */
  readonly tenantId: TenantId;
  /** The tenancy root that owns the tenant. */
  readonly organizationId: OrganizationId;
  /** The actor (opaque `PrincipalId` from identity), or `null` for system/boot. */
  readonly principalId: PrincipalId | null;
  /** Correlation id for cross-cutting event/trace linkage. */
  readonly correlationId: string;
}
