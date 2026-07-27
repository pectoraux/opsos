/**
 * @kernel/api/v1 — APPLICATION-RUNTIME public surface (FROZEN).
 *
 * The layer that turns a protocol into installed, branded, tenant-aware
 * applications. One protocol may power thousands of applications (ADR-0013).
 */

// Manifest + validation
export type {
  BrandingTheme,
  BrandingAssets,
  EmailTemplate,
  ApplicationBranding,
  DomainMapping,
  ApplicationRouting,
  ConfigurationField,
  ConfigurationSchema,
  ConfigurationOverride,
  FeatureFlagDeclaration,
  AuthProviderConfig,
  NavigationEntry,
  LocaleDeclaration,
  UIExtensionBinding,
  InstalledModule,
  ApplicationStatus,
  ApplicationManifest,
  ApplicationDiagnostic,
} from "@kernel/application-runtime";
export {
  validateApplicationManifest,
  applicationManifestIsValid,
} from "@kernel/application-runtime";

// Application + registry
export type {
  Application,
  ApplicationVersionEntry,
  ApplicationSummary,
} from "@kernel/application-runtime";
export {
  InMemoryApplicationRegistry,
} from "@kernel/application-runtime";
export type { ApplicationRegistry } from "@kernel/application-runtime";

// Lifecycle
export type {
  ApplicationLifecycleState,
  ApplicationLifecycleEvent,
  ApplicationTransitionResult,
  ApplicationLifecycleManager,
  DefaultApplicationLifecycleManagerDeps,
} from "@kernel/application-runtime";
export {
  canTransition as canTransitionApplication,
  isLive as isApplicationLive,
  DefaultApplicationLifecycleManager,
} from "@kernel/application-runtime";

// Installer
export type {
  ApplicationInstallerDeps,
  ApplicationInstallResult,
} from "@kernel/application-runtime";
export { installApplication } from "@kernel/application-runtime";

// Resolvers
export {
  resolveBranding,
} from "@kernel/application-runtime";
export type { ResolvedBranding } from "@kernel/application-runtime";

export {
  resolveRouting,
  resolveApplicationForRequest,
} from "@kernel/application-runtime";
export type { ResolvedRoute, ResolvedRouting } from "@kernel/application-runtime";

export {
  resolveConfiguration,
} from "@kernel/application-runtime";
export type { ResolvedConfiguration } from "@kernel/application-runtime";

export {
  resolveFeatureFlags,
  isFeatureEnabled,
} from "@kernel/application-runtime";
export type { FeatureFlagOverrides, ResolvedFeatureFlags } from "@kernel/application-runtime";

export {
  resolveNavigation,
} from "@kernel/application-runtime";
export type { ResolvedNavigationEntry, NavigationResolutionContext } from "@kernel/application-runtime";

export { tenancyOf } from "@kernel/application-runtime";
export type { ApplicationTenancyContext } from "@kernel/application-runtime";

export {
  resolveUIExtensions,
  resolveUIExtensionsByMountPoint,
} from "@kernel/application-runtime";
export type { ResolvedUIExtension } from "@kernel/application-runtime";

export { resolveDomains } from "@kernel/application-runtime";
export type { ResolvedDomains } from "@kernel/application-runtime";

export {
  resolveAuthentication,
} from "@kernel/application-runtime";
export type { ResolvedAuthProvider, ResolvedAuthentication, AuthenticationProvider } from "@kernel/application-runtime";

export { resolveLocalization } from "@kernel/application-runtime";
export type { ResolvedLocalization } from "@kernel/application-runtime";

export { InMemoryApplicationStorage } from "@kernel/application-runtime";
export type { ApplicationStorageConfig, ApplicationStorage } from "@kernel/application-runtime";

export {
  checkCompatibility,
  compareApplicationVersions,
  isUpgrade,
} from "@kernel/application-runtime";
export type { VersionCompatibilityResult } from "@kernel/application-runtime";

// DSL
export { defineApplication } from "@kernel/application-runtime";
export type { DefineApplicationInput } from "@kernel/application-runtime";

// Reference application
export { eksCleanDemoApplication } from "@kernel/application-runtime";
