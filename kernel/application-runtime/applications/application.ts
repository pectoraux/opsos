/**
 * @kernel/application-runtime/applications/application — the runtime Application
 * record (manifest + lifecycle state + audit timestamps).
 *
 * Distinct from the immutable `ApplicationManifest`: the Application record
 * carries lifecycle state and audit timestamps that change over time. The
 * manifest itself never changes (upgrades produce a new manifest version).
 */

import type { ApplicationManifest, ApplicationStatus } from "./application-manifest";
import type { OrganizationId, TenantId } from "@kernel/shared-kernel";
import type { SemverString } from "@kernel/protocol-sdk";

/** A tracked application: manifest + lifecycle state + audit. */
export interface Application {
  readonly manifest: ApplicationManifest;
  readonly status: ApplicationStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly activatedAt?: number;
  readonly suspendedAt?: number;
  /** Application version history (manifest versions installed over time). */
  readonly versionHistory: readonly ApplicationVersionEntry[];
}

export interface ApplicationVersionEntry {
  readonly version: SemverString;
  readonly protocolVersion: SemverString;
  readonly installedAt: number;
  readonly reason?: string;
}

/** A compact summary for list views. */
export interface ApplicationSummary {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly organizationId: OrganizationId;
  readonly tenantId: TenantId;
  readonly protocolId: string;
  readonly protocolVersion: SemverString;
  readonly version: SemverString;
  readonly status: ApplicationStatus;
  readonly primaryDomain?: string;
  readonly featureFlagCount: number;
  readonly navigationCount: number;
}
