/**
 * @kernel/extension/domain/extension-host — the ExtensionHost PORT.
 *
 * A typed registrar surface. Each `registerX` method validates the
 * descriptor, pushes it into the underlying registry via `add(reg)`, and
 * returns the host for chaining. The host is handed to a `Plugin` during
 * `plugin.register(host)` — the plugin uses it to contribute its
 * capabilities, intent types, workflow stages, policies, rules, UI
 * extensions, analytics, API routes, and marketplace listings.
 *
 * !!! ADR-0006 LOUD INVARIANT !!!
 * `registerX` is the ONLY mutation surface for the registry's per-kind
 * stores and it runs at BOOT / PROTOCOL-INSTALL time — it is NOT part of
 * the deterministic core. It executes OUTSIDE `RuntimeExecutor`. The
 * deterministic core (intent → demand → task → plan) NEVER calls
 * `registerX`; it only READS the registry via `host.registry` /
 * `ExtensionRegistry` queries. Adding registrations at runtime inside a
 * command handler is a DETERMINISM VIOLATION.
 *
 * Pure domain layer: depends ONLY on `@kernel/shared-kernel` (type-only —
 * `ExtensionHost` itself has no value imports). No I/O, no `Date.now()`,
 * no `Math.random()`.
 */
import type { ExtensionRegistry } from "./extension-registry";
import type {
  AnalyticsRegistration,
  ApiRouteRegistration,
  CapabilityRegistration,
  IntentTypeRegistration,
  MarketplaceExtensionRegistration,
  PolicyRegistration,
  RuleRegistration,
  UIExtensionRegistration,
  WorkflowStageRegistration,
} from "./registrations";

/**
 * The ExtensionHost PORT — a typed registrar surface.
 *
 * Each `registerX` validates the descriptor, pushes it into the registry
 * via `add(reg)`, and returns the host for chaining. The host is handed to
 * a `Plugin` during `plugin.register(host)`.
 *
 * !!! See file-level invariant: `registerX` runs OUTSIDE the deterministic
 * core (at boot / protocol-install time). The deterministic core only READS
 * the registry.
 */
export interface ExtensionHost {
  registerCapability(reg: CapabilityRegistration): ExtensionHost;
  registerIntentType(reg: IntentTypeRegistration): ExtensionHost;
  registerWorkflowStage(reg: WorkflowStageRegistration): ExtensionHost;
  registerPolicy(reg: PolicyRegistration): ExtensionHost;
  registerRule(reg: RuleRegistration): ExtensionHost;
  registerUIExtension(reg: UIExtensionRegistration): ExtensionHost;
  registerAnalytics(reg: AnalyticsRegistration): ExtensionHost;
  registerApiRoute(reg: ApiRouteRegistration): ExtensionHost;
  registerMarketplaceExtension(
    reg: MarketplaceExtensionRegistration
  ): ExtensionHost;

  /** The registry this host pushes into (read-only view). */
  readonly registry: ExtensionRegistry;
}
