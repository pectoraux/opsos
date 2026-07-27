/**
 * @kernel/application-runtime/sdk/define-application — the `defineApplication()`
 * DSL.
 *
 * Strongly-typed builder for an `ApplicationManifest`. Provides autocomplete +
 * compile-time validation of the shape. The returned manifest is what
 * `installApplication(deps, manifest)` consumes.
 *
 *   export default defineApplication({
 *     manifest: { id: "eks-clean", protocolId: "opsos.protocol.cleaning", ... },
 *   });
 */

import type { ApplicationManifest } from "../applications/application-manifest";
import type { SemverString } from "@kernel/protocol-sdk";
import type { OrganizationId, TenantId } from "@kernel/shared-kernel";

/** Input to `defineApplication()`. */
export interface DefineApplicationInput {
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  readonly organizationId: OrganizationId;
  readonly tenantId: TenantId;
  readonly protocolId: string;
  readonly protocolVersion: SemverString;
  readonly version: SemverString;
  readonly branding: ApplicationManifest["branding"];
  readonly routing: ApplicationManifest["routing"];
  readonly configurationSchema?: ApplicationManifest["configurationSchema"];
  readonly configuration?: ApplicationManifest["configuration"];
  readonly featureFlags?: ApplicationManifest["featureFlags"];
  readonly authentication?: ApplicationManifest["authentication"];
  readonly navigation?: ApplicationManifest["navigation"];
  readonly localization?: ApplicationManifest["localization"];
  readonly uiExtensions?: ApplicationManifest["uiExtensions"];
  readonly installedModules?: ApplicationManifest["installedModules"];
  readonly description?: string;
}

/** Build an `ApplicationManifest` from a partial input (sane defaults filled). */
export function defineApplication(input: DefineApplicationInput): ApplicationManifest {
  return {
    id: input.id,
    name: input.name,
    displayName: input.displayName,
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    protocolId: input.protocolId,
    protocolVersion: input.protocolVersion,
    version: input.version,
    branding: input.branding,
    routing: input.routing,
    configurationSchema: input.configurationSchema ?? { version: 1, fields: [] },
    configuration: input.configuration ?? [],
    featureFlags: input.featureFlags ?? [],
    authentication: input.authentication ?? [],
    navigation: input.navigation ?? [],
    localization: input.localization ?? [],
    uiExtensions: input.uiExtensions ?? [],
    installedModules: input.installedModules ?? [],
    description: input.description,
  };
}
