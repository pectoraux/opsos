/**
 * @kernel/application-runtime/applications/application-manifest — the
 * ApplicationManifest.
 *
 * Analogous to Android's `AndroidManifest.xml` or a Kubernetes deployment
 * manifest. A PROTOCOL describes WHAT capabilities exist; an APPLICATION
 * MANIFEST describes HOW one deployment uses those capabilities.
 *
 * The manifest is IMMUTABLE per version. Upgrading an application produces a
 * NEW manifest. The kernel never reads the manifest's branding/feature fields
 * — those are consumed by the host application layer; the kernel only records
 * the binding (application → protocol@version) + lifecycle state.
 *
 * Pure domain layer. No I/O, no Date.now(), no Math.random().
 */

import type { OrganizationId, TenantId } from "@kernel/shared-kernel";
import type { SemverString } from "@kernel/protocol-sdk";

// ── Branding ────────────────────────────────────────────────────────────────

export interface BrandingTheme {
  readonly primary: string;
  readonly secondary: string;
  readonly accent: string;
  readonly background: string;
  readonly surface: string;
  readonly text: string;
  readonly textMuted: string;
  readonly mode: "light" | "dark" | "auto";
}

export interface BrandingAssets {
  readonly logoUrl?: string;
  readonly logoDarkUrl?: string;
  readonly faviconUrl?: string;
  readonly iconUrl?: string;
  readonly ogImageUrl?: string;
}

export interface EmailTemplate {
  readonly name: string;
  readonly subjectTemplate: string;
  readonly bodyTemplateRef: string;
}

export interface ApplicationBranding {
  readonly displayName: string;
  readonly tagline?: string;
  readonly theme: BrandingTheme;
  readonly assets: BrandingAssets;
  readonly titleTemplate?: string;
  readonly landingPageRef?: string;
  readonly emailTemplates: readonly EmailTemplate[];
  readonly metadata: Readonly<Record<string, string>>;
}

// ── Routing + domains ───────────────────────────────────────────────────────

export interface DomainMapping {
  readonly domain: string;
  readonly primary: boolean;
  readonly sslEnabled: boolean;
  readonly region?: string;
}

export interface ApplicationRouting {
  /** Path-based routing under /apps/{applicationId}. */
  readonly pathPrefix: string;
  /** Custom domains mapped to this application. */
  readonly domains: readonly DomainMapping[];
  /** If true, the application owns the root path `/`. */
  readonly rootRoute: boolean;
  /** Future: multi-region routing config (declared, not enforced in M4). */
  readonly regions?: readonly string[];
}

// ── Configuration ───────────────────────────────────────────────────────────

export interface ConfigurationField {
  readonly key: string;
  readonly type: "string" | "number" | "boolean" | "object" | "array";
  readonly required: boolean;
  readonly default?: unknown;
  readonly description?: string;
  readonly secret?: boolean;
}

export interface ConfigurationSchema {
  readonly version: number;
  readonly fields: readonly ConfigurationField[];
}

export interface ConfigurationOverride {
  readonly layer: "protocol" | "organization" | "application" | "environment";
  readonly values: Readonly<Record<string, unknown>>;
}

// ── Feature flags ───────────────────────────────────────────────────────────

export interface FeatureFlagDeclaration {
  readonly key: string;
  readonly default: boolean;
  readonly description?: string;
}

// ── Authentication ──────────────────────────────────────────────────────────

export interface AuthProviderConfig {
  readonly kind: string;
  readonly providerId: string;
  readonly enabled: boolean;
  readonly configRef: string;
  readonly scopes?: readonly string[];
}

// ── Navigation ──────────────────────────────────────────────────────────────

export interface NavigationEntry {
  readonly id: string;
  readonly label: string;
  readonly viewRef: string;
  readonly order: number;
  readonly iconRef?: string;
  readonly requiredPermission?: string;
  readonly featureFlag?: string;
  readonly children?: readonly NavigationEntry[];
}

// ── Localization ────────────────────────────────────────────────────────────

export interface LocaleDeclaration {
  readonly code: string;
  readonly displayName: string;
  readonly default: boolean;
  readonly resourceBundleRef: string;
}

// ── UI extensions ───────────────────────────────────────────────────────────

export interface UIExtensionBinding {
  readonly mountPoint: string;
  readonly componentRef: string;
  readonly enabled: boolean;
  readonly props?: Readonly<Record<string, unknown>>;
}

// ── Installed modules ───────────────────────────────────────────────────────

export interface InstalledModule {
  readonly moduleId: string;
  readonly version: SemverString;
  readonly enabled: boolean;
}

// ── The manifest ────────────────────────────────────────────────────────────

export type ApplicationStatus =
  | "draft"
  | "installed"
  | "configured"
  | "active"
  | "suspended"
  | "archived"
  | "removed";

/**
 * The immutable manifest every application ships with. Describes how one
 * deployment of a protocol is branded, routed, configured, and presented.
 *
 * The kernel records this manifest + the application's lifecycle state; it
 * does NOT interpret branding/theme/navigation fields (those are consumed by
 * the host application layer at render time).
 */
export interface ApplicationManifest {
  /** Application id, e.g. `"eks-clean"`. */
  readonly id: string;
  readonly name: string;
  readonly displayName: string;
  /** The organization that owns this application. */
  readonly organizationId: OrganizationId;
  readonly tenantId: TenantId;
  /** The protocol this application is an instance of. */
  readonly protocolId: string;
  /** Pinned protocol version. */
  readonly protocolVersion: SemverString;
  /** Semver version of THIS manifest. */
  readonly version: SemverString;
  readonly branding: ApplicationBranding;
  readonly routing: ApplicationRouting;
  readonly configurationSchema: ConfigurationSchema;
  readonly configuration: readonly ConfigurationOverride[];
  readonly featureFlags: readonly FeatureFlagDeclaration[];
  readonly authentication: readonly AuthProviderConfig[];
  readonly navigation: readonly NavigationEntry[];
  readonly localization: readonly LocaleDeclaration[];
  readonly uiExtensions: readonly UIExtensionBinding[];
  readonly installedModules: readonly InstalledModule[];
  readonly description?: string;
}
