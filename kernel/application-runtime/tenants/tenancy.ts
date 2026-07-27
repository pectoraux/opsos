/**
 * @kernel/application-runtime/tenants — tenancy model.
 *
 * Applications belong to organizations. Organizations own users. Applications
 * never own users. The kernel's identity module owns principals; the
 * application runtime only records the org/tenant binding.
 */

import type { OrganizationId, TenantId } from "@kernel/shared-kernel";

export interface ApplicationTenancyContext {
  readonly applicationId: string;
  readonly organizationId: OrganizationId;
  readonly tenantId: TenantId;
}

export function tenancyOf(manifest: {
  readonly id: string;
  readonly organizationId: OrganizationId;
  readonly tenantId: TenantId;
}): ApplicationTenancyContext {
  return {
    applicationId: manifest.id,
    organizationId: manifest.organizationId,
    tenantId: manifest.tenantId,
  };
}
