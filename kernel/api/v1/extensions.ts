/**
 * @kernel/api/v1 — EXTENSIONS public surface (FROZEN).
 *
 * The protocol host: plugin manifest, the extension host, the registry, and
 * the 9 registration contracts. Per ADR-0006 the kernel ships host + registry
 * + contracts ONLY — no protocol plugins.
 */
export type {
  ExtensionId,
  ExtensionDependency,
  ExtensionManifest,
  Plugin,
  ExtensionContext,
  ExtensionHost,
  ExtensionRegistry,
  MutableExtensionRegistry,
  CapabilityRegistration,
  IntentTypeRegistration,
  WorkflowStageRegistration,
  PolicyRegistration,
  RuleRegistration,
  UIExtensionRegistration,
  AnalyticsRegistration,
  ApiRouteRegistration,
  MarketplaceExtensionRegistration,
  ExtensionRegistration,
  ExtensionRegistrationKind,
} from "@kernel/extension";

export {
  validateManifest,
  installPlugin,
  listByProtocol,
  listProviding,
  InMemoryExtensionRegistry,
  DefaultExtensionHost,
} from "@kernel/extension";
