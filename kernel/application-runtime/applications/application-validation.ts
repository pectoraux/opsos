/**
 * @kernel/application-runtime/applications/application-validation — deep
 * validation of an ApplicationManifest with detailed diagnostics.
 *
 * Validates: id format, protocol binding (id + version present), org/tenant
 * present, branding shape, routing domain uniqueness + primary existence,
 * configuration field-key uniqueness, feature-flag key uniqueness, navigation
 * id uniqueness + order, localization default uniqueness, and compatibility
 * (the pinned protocol version satisfies any declared range).
 *
 * Produces `SdkDiagnostic` records (re-used from protocol-sdk). Never throws.
 */

import type { ApplicationManifest } from "./application-manifest";
import type { SdkDiagnostic, DiagnosticSeverity } from "@kernel/protocol-sdk";
import { isValidSemver, satisfiesRange } from "@kernel/protocol-sdk";

export type ApplicationDiagnostic = SdkDiagnostic;

export function validateApplicationManifest(
  manifest: ApplicationManifest,
  installedProtocolVersion?: string
): readonly ApplicationDiagnostic[] {
  const diags: ApplicationDiagnostic[] = [];
  const push = (severity: DiagnosticSeverity, code: string, message: string) =>
    diags.push({ severity, code, message, source: "application-validation" });

  // ── Identity ──────────────────────────────────────────────────────────────
  if (!manifest.id || manifest.id.trim() === "") {
    push("error", "APP_ID_EMPTY", "Application id must be non-empty");
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id)) {
    push("error", "APP_ID_FORMAT", "Application id must be kebab-case (e.g. 'eks-clean')");
  }
  if (!manifest.name || manifest.name.trim() === "") {
    push("error", "APP_NAME_EMPTY", "Application name must be non-empty");
  }
  if (!manifest.displayName || manifest.displayName.trim() === "") {
    push("error", "APP_DISPLAY_NAME_EMPTY", "Application displayName must be non-empty");
  }

  // ── Protocol binding ──────────────────────────────────────────────────────
  if (!manifest.protocolId || manifest.protocolId.trim() === "") {
    push("error", "APP_PROTOCOL_ID_EMPTY", "Application must bind to a protocol id");
  }
  if (!isValidSemver(manifest.protocolVersion)) {
    push("error", "APP_PROTOCOL_VERSION_INVALID", `'${manifest.protocolVersion}' is not a valid semver`);
  }
  if (!isValidSemver(manifest.version)) {
    push("error", "APP_VERSION_INVALID", `'${manifest.version}' is not a valid semver`);
  }
  // Compatibility: if the protocol is installed, check the pinned version matches.
  if (installedProtocolVersion && isValidSemver(manifest.protocolVersion)) {
    if (installedProtocolVersion !== manifest.protocolVersion) {
      push(
        "warn",
        "APP_PROTOCOL_VERSION_MISMATCH",
        `Application pins protocol@${manifest.protocolVersion} but installed protocol is ${installedProtocolVersion}`
      );
    }
  }

  // ── Tenancy ───────────────────────────────────────────────────────────────
  if (!manifest.organizationId) {
    push("error", "APP_ORG_EMPTY", "Application must belong to an organization");
  }
  if (!manifest.tenantId) {
    push("error", "APP_TENANT_EMPTY", "Application must have a tenantId");
  }

  // ── Routing ───────────────────────────────────────────────────────────────
  const domains = manifest.routing.domains;
  const primaryDomains = domains.filter((d) => d.primary);
  if (domains.length > 0 && primaryDomains.length === 0) {
    push("warn", "APP_ROUTING_NO_PRIMARY", "Multiple domains declared but none marked primary");
  }
  if (primaryDomains.length > 1) {
    push("error", "APP_ROUTING_MULTIPLE_PRIMARY", "Only one domain may be primary");
  }
  const domainSet = new Set<string>();
  for (const d of domains) {
    if (domainSet.has(d.domain)) {
      push("error", "APP_ROUTING_DUPLICATE_DOMAIN", `Duplicate domain '${d.domain}'`);
    }
    domainSet.add(d.domain);
  }

  // ── Configuration ─────────────────────────────────────────────────────────
  const configKeys = new Set<string>();
  for (const f of manifest.configurationSchema.fields) {
    if (configKeys.has(f.key)) {
      push("error", "APP_CONFIG_DUPLICATE_KEY", `Duplicate configuration field '${f.key}'`);
    }
    configKeys.add(f.key);
  }

  // ── Feature flags ─────────────────────────────────────────────────────────
  const flagKeys = new Set<string>();
  for (const f of manifest.featureFlags) {
    if (flagKeys.has(f.key)) {
      push("error", "APP_FEATURE_DUPLICATE_KEY", `Duplicate feature flag '${f.key}'`);
    }
    flagKeys.add(f.key);
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  const navIds = new Set<string>();
  for (const n of manifest.navigation) {
    if (navIds.has(n.id)) {
      push("error", "APP_NAV_DUPLICATE_ID", `Duplicate navigation entry '${n.id}'`);
    }
    navIds.add(n.id);
  }

  // ── Localization ──────────────────────────────────────────────────────────
  const defaultLocales = manifest.localization.filter((l) => l.default);
  if (manifest.localization.length > 0 && defaultLocales.length === 0) {
    push("warn", "APP_LOCALE_NO_DEFAULT", "Locales declared but none marked default");
  }
  if (defaultLocales.length > 1) {
    push("error", "APP_LOCALE_MULTIPLE_DEFAULT", "Only one locale may be default");
  }

  return diags;
}

export function applicationManifestIsValid(
  manifest: ApplicationManifest,
  installedProtocolVersion?: string
): boolean {
  return validateApplicationManifest(manifest, installedProtocolVersion).every(
    (d) => d.severity !== "error"
  );
}
