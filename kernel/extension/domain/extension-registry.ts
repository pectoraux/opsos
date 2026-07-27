/**
 * @kernel/extension/domain/extension-registry — the ExtensionRegistry PORT.
 *
 * The registry holds:
 *   - the set of installed `Plugin`s (keyed by manifest id)
 *   - the per-kind registration descriptors each plugin pushed via the host
 *
 * It is a READ-ONLY surface for the deterministic core: queries
 * (`capabilities()`, `intentTypes()`, ...) return immutable arrays. The ONLY
 * mutation surface is `registerPlugin` (called by `installPlugin` at boot
 * time) and the internal `add(reg)` method on `MutableExtensionRegistry`
 * (called by the host during `plugin.register(host)`). Both run OUTSIDE the
 * deterministic core.
 *
 * Per ADR-0006 the registry references canonical primitive TYPES from
 * `@kernel/shared-kernel` ONLY — never other modules' application /
 * infrastructure — so protocols can be installed without dragging in the
 * whole kernel.
 *
 * Pure domain layer: depends ONLY on `@kernel/shared-kernel` (`Result` /
 * `KernelError`). No I/O, no `Date.now()`, no `Math.random()`.
 */
import type { KernelError, Result } from "@kernel/shared-kernel";
import type { ExtensionId } from "./manifest";
import type { Plugin } from "./plugin";
import type {
  AnalyticsRegistration,
  ApiRouteRegistration,
  CapabilityRegistration,
  ExtensionRegistration,
  IntentTypeRegistration,
  MarketplaceExtensionRegistration,
  PolicyRegistration,
  RuleRegistration,
  UIExtensionRegistration,
  WorkflowStageRegistration,
} from "./registrations";

/**
 * The ExtensionRegistry PORT.
 *
 * Read surface for the deterministic core + the `registerPlugin` /
 * `unregisterPlugin` mutation surface invoked at boot / protocol-install
 * time (via `installPlugin`) — OUTSIDE `RuntimeExecutor`.
 */
export interface ExtensionRegistry {
  /**
   * Register an installed plugin. Validates manifest-id uniqueness. Called
   * by `installPlugin` AFTER `plugin.register(host)` has pushed the
   * plugin's descriptors. Returns `err(ValidationError)` on duplicate id.
   */
  registerPlugin(plugin: Plugin): Result<void, KernelError>;

  /**
   * Remove a plugin by manifest id. Implementations SHOULD also remove the
   * per-kind registrations contributed by this plugin so the registry does
   * not leak descriptors after uninstall. Idempotent — unregistering an
   * unknown id is a no-op.
   */
  unregisterPlugin(extensionId: ExtensionId): void;

  /** Look up a plugin by manifest id. */
  getPlugin(extensionId: ExtensionId): Plugin | undefined;

  /** All installed plugins, in insertion order. */
  listPlugins(): readonly Plugin[];

  // ── Per-kind typed lookups (insertion order) ──────────────────────────
  capabilities(): readonly CapabilityRegistration[];
  intentTypes(): readonly IntentTypeRegistration[];
  workflowStages(): readonly WorkflowStageRegistration[];
  policies(): readonly PolicyRegistration[];
  rules(): readonly RuleRegistration[];
  uiExtensions(): readonly UIExtensionRegistration[];
  analytics(): readonly AnalyticsRegistration[];
  apiRoutes(): readonly ApiRouteRegistration[];
  marketplace(): readonly MarketplaceExtensionRegistration[];

  /** All registrations across all kinds, in insertion order. */
  all(): readonly ExtensionRegistration[];
}

/**
 * Internal mutation surface used by `ExtensionHost` implementations to push
 * per-kind descriptors into the registry during `plugin.register(host)`.
 *
 * NOT part of the public `ExtensionRegistry` contract — implementations
 * expose this via a separate interface so the host (infrastructure) can call
 * it while the deterministic core (which only sees `ExtensionRegistry`)
 * cannot.
 *
 * !!! ADR-0006 LOUD INVARIANT !!!
 * `add` is called ONLY during `plugin.register(host)` at BOOT /
 * PROTOCOL-INSTALL time — OUTSIDE the deterministic core. The deterministic
 * core (RuntimeExecutor) never calls `add`; it only READS the registry.
 */
export interface MutableExtensionRegistry extends ExtensionRegistry {
  /**
   * Push a registration descriptor into the per-kind store. Switches on
   * `reg.kind`. Called by the host's `registerX` methods.
   */
  add(reg: ExtensionRegistration): void;
}
