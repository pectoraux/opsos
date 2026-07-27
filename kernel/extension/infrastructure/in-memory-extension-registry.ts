/**
 * @kernel/extension/infrastructure/in-memory-extension-registry — reference
 * Map-based `MutableExtensionRegistry`.
 *
 * Holds:
 *   - `Plugin`s in a `Map<ExtensionId, Plugin>` (insertion order preserved)
 *   - per-kind registration descriptors in 9 arrays (insertion order)
 *
 * `registerPlugin` enforces manifest structural validity + manifest-id
 * uniqueness (returns `err(ValidationError)` on failure / duplicate).
 * `add(reg)` switches on `reg.kind` and pushes into the matching array.
 * `unregisterPlugin` removes the plugin AND its contributed registrations so
 * the registry does not leak descriptors after uninstall.
 *
 * Suitable for kernel self-test, the read-only inspector, and tests. NOT for
 * production persistence (no durability, no concurrency control beyond JS's
 * single-threaded execution, no plugin sandboxing).
 *
 * !!! ADR-0006 LOUD INVARIANT !!!
 * `add` / `registerPlugin` / `unregisterPlugin` are the ONLY mutation
 * surface and run at BOOT / PROTOCOL-INSTALL time — OUTSIDE the
 * deterministic core. The deterministic core (RuntimeExecutor) only READS
 * the registry via the query methods (`capabilities()`, `policies()`, ...).
 *
 * Determinism: no `Date.now()` / `Math.random()`. The registry is pure data;
 * the only side-effect is mutation of in-memory arrays / maps.
 */
import {
  type KernelError,
  type Result,
  ValidationError,
  err,
  ok,
} from "@kernel/shared-kernel";
import type {
  MutableExtensionRegistry,
} from "../domain/extension-registry";
import { validateManifest } from "../domain/manifest";
import type { ExtensionId } from "../domain/manifest";
import type { Plugin } from "../domain/plugin";
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
} from "../domain/registrations";

/**
 * Reference in-memory `MutableExtensionRegistry`. See file-level JSDoc.
 */
export class InMemoryExtensionRegistry implements MutableExtensionRegistry {
  /** Installed plugins keyed by manifest id. Insertion order preserved. */
  private readonly plugins: Map<ExtensionId, Plugin> = new Map();

  // ── Per-kind registration stores (insertion order) ────────────────────
  //
  // `readonly` on the field means the array REFERENCE is fixed; the array
  // contents are mutated via `push` (in `add`) and `splice` (in
  // `unregisterPlugin`).
  private readonly _capabilities: CapabilityRegistration[] = [];
  private readonly _intentTypes: IntentTypeRegistration[] = [];
  private readonly _workflowStages: WorkflowStageRegistration[] = [];
  private readonly _policies: PolicyRegistration[] = [];
  private readonly _rules: RuleRegistration[] = [];
  private readonly _uiExtensions: UIExtensionRegistration[] = [];
  private readonly _analytics: AnalyticsRegistration[] = [];
  private readonly _apiRoutes: ApiRouteRegistration[] = [];
  private readonly _marketplace: MarketplaceExtensionRegistration[] = [];

  // ── Mutation surface (host → registry) ────────────────────────────────

  /**
   * Push a registration descriptor into the per-kind store. Switches on
   * `reg.kind`. Throws `ValidationError` on unknown kind (defensive — TS
   * exhaustiveness prevents this at the type level).
   *
   * !!! ADR-0006: called ONLY during `plugin.register(host)` at BOOT /
   * PROTOCOL-INSTALL time — OUTSIDE the deterministic core.
   */
  add(reg: ExtensionRegistration): void {
    switch (reg.kind) {
      case "capability":
        this._capabilities.push(reg);
        return;
      case "intent-type":
        this._intentTypes.push(reg);
        return;
      case "workflow-stage":
        this._workflowStages.push(reg);
        return;
      case "policy":
        this._policies.push(reg);
        return;
      case "rule":
        this._rules.push(reg);
        return;
      case "ui-extension":
        this._uiExtensions.push(reg);
        return;
      case "analytics":
        this._analytics.push(reg);
        return;
      case "api-route":
        this._apiRoutes.push(reg);
        return;
      case "marketplace-extension":
        this._marketplace.push(reg);
        return;
      default: {
        // Defensive — TS exhaustiveness prevents this at the type level.
        // A caller using `as any` to bypass types would be caught here.
        const exhaustive: never = reg;
        throw new ValidationError(
          `unknown registration kind: ${(exhaustive as { kind: string }).kind}`
        );
      }
    }
  }

  /**
   * Register an installed plugin. Validates the manifest structurally +
   * enforces manifest-id uniqueness.
   *
   * !!! ADR-0006: called by `installPlugin` AFTER `plugin.register(host)` —
   * at BOOT / PROTOCOL-INSTALL time, OUTSIDE the deterministic core.
   */
  registerPlugin(plugin: Plugin): Result<void, KernelError> {
    const validation = validateManifest(plugin.manifest);
    if (!validation.ok) {
      return validation;
    }
    if (this.plugins.has(plugin.manifest.id)) {
      return err(
        new ValidationError(
          `extension '${plugin.manifest.id}' is already registered`,
          [{ field: "manifest.id", reason: "duplicate" }]
        )
      );
    }
    this.plugins.set(plugin.manifest.id, plugin);
    return ok(undefined);
  }

  /**
   * Remove a plugin by manifest id AND its contributed registrations.
   * Idempotent — unregistering an unknown id is a no-op.
   */
  unregisterPlugin(extensionId: ExtensionId): void {
    if (!this.plugins.has(extensionId)) return;
    this.plugins.delete(extensionId);
    // Remove all registrations contributed by this plugin so the registry
    // does not leak descriptors after uninstall.
    removeAll(this._capabilities, extensionId);
    removeAll(this._intentTypes, extensionId);
    removeAll(this._workflowStages, extensionId);
    removeAll(this._policies, extensionId);
    removeAll(this._rules, extensionId);
    removeAll(this._uiExtensions, extensionId);
    removeAll(this._analytics, extensionId);
    removeAll(this._apiRoutes, extensionId);
    removeAll(this._marketplace, extensionId);
  }

  // ── Plugin lookups ────────────────────────────────────────────────────

  getPlugin(extensionId: ExtensionId): Plugin | undefined {
    return this.plugins.get(extensionId);
  }

  listPlugins(): readonly Plugin[] {
    return Array.from(this.plugins.values());
  }

  // ── Per-kind typed lookups (fresh array each call) ────────────────────

  capabilities(): readonly CapabilityRegistration[] {
    return this._capabilities.slice();
  }

  intentTypes(): readonly IntentTypeRegistration[] {
    return this._intentTypes.slice();
  }

  workflowStages(): readonly WorkflowStageRegistration[] {
    return this._workflowStages.slice();
  }

  policies(): readonly PolicyRegistration[] {
    return this._policies.slice();
  }

  rules(): readonly RuleRegistration[] {
    return this._rules.slice();
  }

  uiExtensions(): readonly UIExtensionRegistration[] {
    return this._uiExtensions.slice();
  }

  analytics(): readonly AnalyticsRegistration[] {
    return this._analytics.slice();
  }

  apiRoutes(): readonly ApiRouteRegistration[] {
    return this._apiRoutes.slice();
  }

  marketplace(): readonly MarketplaceExtensionRegistration[] {
    return this._marketplace.slice();
  }

  /**
   * All registrations across all kinds, in insertion order (per-kind arrays
   * concatenated in the canonical kind order). Fresh array each call.
   */
  all(): readonly ExtensionRegistration[] {
    const out: ExtensionRegistration[] = [];
    for (const r of this._capabilities) out.push(r);
    for (const r of this._intentTypes) out.push(r);
    for (const r of this._workflowStages) out.push(r);
    for (const r of this._policies) out.push(r);
    for (const r of this._rules) out.push(r);
    for (const r of this._uiExtensions) out.push(r);
    for (const r of this._analytics) out.push(r);
    for (const r of this._apiRoutes) out.push(r);
    for (const r of this._marketplace) out.push(r);
    return out;
  }
}

/**
 * In-place remove all elements of `arr` whose `extensionId` equals `id`.
 *
 * Iterates backward so `splice` doesn't disturb unvisited indices. O(n) per
 * call — acceptable for an in-memory test registry.
 */
function removeAll<T extends { readonly extensionId: ExtensionId }>(
  arr: T[],
  id: ExtensionId
): void {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].extensionId === id) {
      arr.splice(i, 1);
    }
  }
}
