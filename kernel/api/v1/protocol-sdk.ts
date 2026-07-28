/**
 * @kernel/api/v1 — PROTOCOL-SDK public surface (FROZEN).
 *
 * The plugin system that turns OpsOS from a kernel into an extensible OS.
 * Protocols describe work; they never execute it (ADR-0012).
 */

// Manifest + validation
export type {
  SemverString,
  SemverRange,
  ProtocolDependency,
  ProtocolPermission,
  ProtocolAuthor,
  ProtocolManifest,
  ManifestDiagnostic,
} from "@kernel/protocol-sdk";
export {
  KERNEL_API_VERSION,
  KERNEL_VERSION,
  validateProtocolManifest,
  manifestIsValid,
  parseSemver,
  isValidSemver,
  compareSemver,
  satisfiesRange,
  resolveDependencyOrder,
  nodeOf,
  hasErrors,
  errorsOnly,
} from "@kernel/protocol-sdk";
export type {
  SdkDiagnostic,
  // NOTE: DiagnosticSeverity is aliased here because both the compiler and the
  // protocol-sdk export a type of this name with the same shape. The SDK's
  // version is re-exported as `SdkDiagnosticSeverity` to avoid a collision in
  // the v1 barrel.
  DiagnosticSeverity as SdkDiagnosticSeverity,
  DependencyNode,
  DependencyResolution,
} from "@kernel/protocol-sdk";

// Lifecycle
export type {
  ProtocolLifecycleState,
  LifecycleEvent,
  TrackedProtocol,
  LifecycleTransitionResult,
  ProtocolLifecycleManager,
  DefaultLifecycleManagerDeps,
} from "@kernel/protocol-sdk";
export {
  canTransition,
  isLive,
  DefaultLifecycleManager,
} from "@kernel/protocol-sdk";

// Registries (per-kind)
export type {
  ProtocolCapability,
  CapabilityRegistry,
  CapabilityPort,
  // Alias to avoid collision with shared-kernel's CapabilityRequirement value object.
  CapabilityRequirement as ProtocolCapabilityRequirement,
  QualityMetric,
  CostModel,
} from "@kernel/protocol-sdk";
export { InMemoryCapabilityRegistry } from "@kernel/protocol-sdk";

export type {
  ProtocolIntentType,
  IntentRegistry,
  CompilerHook,
  IntentDefaultPolicy,
} from "@kernel/protocol-sdk";
export { InMemoryIntentRegistry } from "@kernel/protocol-sdk";

export type {
  ProtocolCompilerStage,
  CompilerExtensionRegistry,
  InsertionPolicy,
} from "@kernel/protocol-sdk";
export { InMemoryCompilerExtensionRegistry } from "@kernel/protocol-sdk";

export type {
  WorkflowTemplate,
  WorkflowStageTemplate,
  WorkflowRegistry,
} from "@kernel/protocol-sdk";
export { InMemoryWorkflowRegistry } from "@kernel/protocol-sdk";

export type {
  ProtocolPolicy,
  ProtocolRule,
  PolicyContributionRegistry,
} from "@kernel/protocol-sdk";
export { InMemoryPolicyContributionRegistry } from "@kernel/protocol-sdk";

export type {
  ProtocolReadModel,
  ReadModelRegistry,
} from "@kernel/protocol-sdk";
export { InMemoryReadModelRegistry } from "@kernel/protocol-sdk";

export type {
  ProtocolAnalytics,
  AnalyticsContributionRegistry,
} from "@kernel/protocol-sdk";
export { InMemoryAnalyticsContributionRegistry } from "@kernel/protocol-sdk";

export type {
  UIExtensionContribution,
  NavigationContribution,
  UIContributionRegistry,
} from "@kernel/protocol-sdk";
export { InMemoryUIContributionRegistry } from "@kernel/protocol-sdk";

export type {
  ProtocolApiRoute,
  RouteRegistry,
} from "@kernel/protocol-sdk";
export { InMemoryRouteRegistry } from "@kernel/protocol-sdk";

export type {
  RecommendationProvider,
  RecommendationRegistry,
} from "@kernel/protocol-sdk";
export { InMemoryRecommendationRegistry } from "@kernel/protocol-sdk";

export type {
  ProtocolEventType,
  EventTypeRegistry,
} from "@kernel/protocol-sdk";
export { InMemoryEventTypeRegistry } from "@kernel/protocol-sdk";

export type {
  ProtocolPricing,
  PricingTier,
  PricingRegistry,
} from "@kernel/protocol-sdk";
export { InMemoryPricingRegistry } from "@kernel/protocol-sdk";

// Master registry + host
export { ProtocolRegistry, ProtocolHost } from "@kernel/protocol-sdk";
export type { ProtocolContributions } from "@kernel/protocol-sdk";

// DSL (developer experience)
export {
  defineProtocol,
  defineCapability,
  defineIntent,
  definePolicy,
  defineRule,
  defineWorkflow,
  defineCompilerStage,
  defineReadModel,
} from "@kernel/protocol-sdk";
export type {
  Protocol,
  ProtocolRegisterFn,
  DefineProtocolInput,
  ProtocolBuilder,
  DefineCapabilityInput,
  DefineIntentInput,
  DefinePolicyInput,
  DefineRuleInput,
  DefineWorkflowInput,
  DefineWorkflowStageInput,
  DefineCompilerStageInput,
  DefineReadModelInput,
} from "@kernel/protocol-sdk";

// Reference protocol
export { demoProtocol } from "@kernel/protocol-sdk";
